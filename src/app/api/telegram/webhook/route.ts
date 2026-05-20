import { NextRequest, NextResponse } from "next/server";
import { getDb, isDbConfigured } from "@/lib/db";
import { sendMessage } from "@/lib/telegram/client";
import type { TgMessage, TgUpdate } from "@/lib/telegram/types";

export const runtime = "edge";

const SECRET_HEADER = "x-telegram-bot-api-secret-token";

function verifySecret(req: NextRequest): boolean {
  const expected = process.env.TELEGRAM_WEBHOOK_SECRET;
  // If no secret is configured we accept all requests. This is convenient
  // for local development but must never happen in production — the setup
  // script always sets a secret when one is provided.
  if (!expected) return true;
  return req.headers.get(SECRET_HEADER) === expected;
}

function resolveLocale(languageCode?: string): "uk" | "ru" {
  return languageCode === "ru" ? "ru" : "uk";
}

function welcomeText(locale: "uk" | "ru", linked: boolean): string {
  if (locale === "ru") {
    if (linked) {
      return [
        "Привет! Заявку вижу — ты в системе.",
        "",
        "Здесь буду присылать материалы Immersion Week, напоминания о Live Zoom и ссылку на оплату.",
        "Если возникнут вопросы — пиши прямо сюда.",
      ].join("\n");
    }
    return [
      "Привет! Это бот RESOUL — Immersion Week.",
      "",
      "Чтобы попасть в поток: заполни форму на сайте и вернись в этот чат — я свяжу твою заявку с этим аккаунтом и буду присылать материалы, напоминания и ссылку на оплату.",
    ].join("\n");
  }
  if (linked) {
    return [
      "Привіт! Заявку бачу — ти в системі.",
      "",
      "Тут надсилатиму матеріали Immersion Week, нагадування про Live Zoom і посилання на оплату.",
      "Якщо виникнуть питання — пиши прямо сюди.",
    ].join("\n");
  }
  return [
    "Привіт! Це бот RESOUL — Immersion Week.",
    "",
    "Щоб потрапити в потік: заповни форму на сайті і повернись у цей чат — я зв'яжу заявку з цим акаунтом і надсилатиму матеріали, нагадування та посилання на оплату.",
  ].join("\n");
}

function helpText(locale: "uk" | "ru"): string {
  if (locale === "ru") {
    return [
      "Команды:",
      "/start — запустить или перепривязать заявку",
      "/help — это сообщение",
    ].join("\n");
  }
  return [
    "Команди:",
    "/start — запустити або перепривʼязати заявку",
    "/help — це повідомлення",
  ].join("\n");
}

/**
 * Persist or update the tg_users row and try to link the chat to a public.users
 * record. Returns whether linkage to a users row was achieved.
 */
async function upsertTgUserAndLink(
  message: TgMessage,
  payload: string | undefined
): Promise<boolean> {
  if (!message.from) return false;
  if (!isDbConfigured()) return false;

  const sql = getDb()!;
  const chatId = message.chat.id;
  const user = message.from;

  try {
    await sql`
      insert into tg_users (
        tg_chat_id, tg_username, tg_first_name, tg_last_name,
        is_bot, language_code, start_payload
      )
      values (
        ${chatId}, ${user.username ?? null}, ${user.first_name},
        ${user.last_name ?? null}, ${user.is_bot},
        ${user.language_code ?? null}, ${payload ?? null}
      )
      on conflict (tg_chat_id) do update set
        tg_username   = excluded.tg_username,
        tg_first_name = excluded.tg_first_name,
        tg_last_name  = excluded.tg_last_name,
        language_code = excluded.language_code,
        start_payload = coalesce(tg_users.start_payload, excluded.start_payload)
    `;

    let userId: string | null = null;

    // 1) Deep-link payload from thank-you page: "lead_<uuid>"
    if (payload && payload.startsWith("lead_")) {
      const candidate = payload.slice("lead_".length);
      // Defensive: only attempt the lookup if it shape-matches a uuid
      if (
        /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(
          candidate
        )
      ) {
        const rows = (await sql`
          select id from users where id = ${candidate}::uuid limit 1
        `) as { id: string }[];
        if (rows[0]) userId = rows[0].id;
      }
    }

    // 2) Fallback: match by @username on the users table
    if (!userId && user.username) {
      const rows = (await sql`
        select id from users
        where lower(tg_username) = lower(${user.username})
        order by created_at desc
        limit 1
      `) as { id: string }[];
      if (rows[0]) userId = rows[0].id;
    }

    if (userId) {
      await sql`
        update tg_users set user_id = ${userId} where tg_chat_id = ${chatId}
      `;
      await sql`
        update users set tg_id = ${chatId} where id = ${userId}::uuid
      `;
      return true;
    }
    return false;
  } catch (err) {
    console.error("[tg:webhook:db_error]", err);
    return false;
  }
}

async function handleStart(
  message: TgMessage,
  payload: string | undefined
): Promise<void> {
  const linked = await upsertTgUserAndLink(message, payload);
  const locale = resolveLocale(message.from?.language_code);
  const res = await sendMessage({
    chat_id: message.chat.id,
    text: welcomeText(locale, linked),
    disable_web_page_preview: true,
  });
  if (!res.ok) {
    console.warn("[tg:webhook:welcome_send_failed]", res.description);
  }
}

async function handleHelp(message: TgMessage): Promise<void> {
  const locale = resolveLocale(message.from?.language_code);
  await sendMessage({
    chat_id: message.chat.id,
    text: helpText(locale),
    disable_web_page_preview: true,
  });
}

export async function POST(req: NextRequest) {
  if (!verifySecret(req)) {
    return new NextResponse("forbidden", { status: 403 });
  }

  let update: TgUpdate;
  try {
    update = (await req.json()) as TgUpdate;
  } catch {
    return new NextResponse("bad request", { status: 400 });
  }

  const message = update.message ?? update.edited_message;
  if (!message?.text) {
    // Telegram retries on non-2xx, so always 200 unless we want a retry.
    return NextResponse.json({ ok: true });
  }

  const text = message.text.trim();
  if (text.startsWith("/start")) {
    const parts = text.split(/\s+/);
    const payload = parts.length > 1 ? parts.slice(1).join(" ") : undefined;
    await handleStart(message, payload);
  } else if (text.startsWith("/help")) {
    await handleHelp(message);
  }

  return NextResponse.json({ ok: true });
}

// GET is useful as a cheap liveness check for the route. We deliberately do
// not expose any bot internals.
export function GET() {
  return NextResponse.json({ ok: true, service: "telegram-webhook" });
}
