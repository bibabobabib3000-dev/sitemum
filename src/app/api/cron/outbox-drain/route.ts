import { NextRequest } from "next/server";
import { jsonErr, jsonOk } from "@/lib/api-response";
import { getDb, isDbConfigured } from "@/lib/db";
import {
  fetchPending,
  markFailed,
  markSent,
  type OutboxRow,
} from "@/lib/notifications/outbox";
import {
  renderEmail,
  renderTelegram,
  type RenderLocale,
} from "@/lib/notifications/render";
import { isResendConfigured, sendEmail } from "@/lib/email/resend";
import { isTelegramConfigured, sendMessage } from "@/lib/telegram/client";

export const runtime = "edge";
export const dynamic = "force-dynamic";

interface DeliveryTarget {
  email: string | null;
  fullName: string | null;
  locale: RenderLocale;
  tgChatId: number | null;
  tgUsername: string | null;
}

async function loadTarget(userId: string): Promise<DeliveryTarget | null> {
  if (!isDbConfigured()) return null;
  const sql = getDb()!;
  const rows = (await sql`
    select u.email,
           u.full_name,
           u.locale,
           u.tg_id,
           u.tg_username
    from users u
    where u.id = ${userId}::uuid
    limit 1
  `) as {
    email: string | null;
    full_name: string | null;
    locale: string | null;
    tg_id: string | number | null;
    tg_username: string | null;
  }[];
  if (rows.length === 0) return null;
  const r = rows[0];
  return {
    email: r.email,
    fullName: r.full_name,
    locale: r.locale === "ru" ? "ru" : "uk",
    tgChatId: r.tg_id !== null ? Number(r.tg_id) : null,
    tgUsername: r.tg_username,
  };
}

async function lookupTgChatByUsername(username: string): Promise<number | null> {
  if (!isDbConfigured()) return null;
  const sql = getDb()!;
  const rows = (await sql`
    select tg_chat_id from tg_users
    where lower(tg_username) = lower(${username})
    order by started_at desc nulls last
    limit 1
  `) as { tg_chat_id: string | number }[];
  if (rows.length === 0) return null;
  return Number(rows[0].tg_chat_id);
}

function authorized(req: NextRequest): boolean {
  const expected = process.env.CRON_SECRET?.trim();
  if (!expected) {
    // Without an explicit secret, only allow Vercel's cron pings.
    return req.headers.get("x-vercel-cron") !== null;
  }
  const header = req.headers.get("authorization") ?? "";
  return header === `Bearer ${expected}`;
}

async function deliver(row: OutboxRow): Promise<{ ok: boolean; reason?: string }> {
  if (!row.userId) {
    return { ok: false, reason: "no_user_id" };
  }
  const target = await loadTarget(row.userId);
  if (!target) {
    return { ok: false, reason: "user_not_found" };
  }

  if (row.channel === "email") {
    if (!target.email) return { ok: false, reason: "no_email" };
    if (!isResendConfigured()) {
      return { ok: false, reason: "resend_not_configured" };
    }
    const rendered = renderEmail(target.locale, row.payload);
    const res = await sendEmail({
      to: target.email,
      subject: rendered.subject,
      html: rendered.html,
      text: rendered.text,
    });
    return res.ok ? { ok: true } : { ok: false, reason: res.error ?? "send_failed" };
  }

  if (row.channel === "telegram") {
    if (!isTelegramConfigured()) {
      return { ok: false, reason: "telegram_not_configured" };
    }
    let chatId = target.tgChatId;
    if (!chatId && target.tgUsername) {
      chatId = await lookupTgChatByUsername(target.tgUsername);
    }
    if (!chatId) {
      return { ok: false, reason: "chat_id_unknown" };
    }
    const rendered = renderTelegram(target.locale, row.payload);
    const res = await sendMessage({
      chat_id: chatId,
      text: rendered.text,
      disable_web_page_preview: true,
    });
    return res.ok ? { ok: true } : { ok: false, reason: res.description ?? "send_failed" };
  }

  return { ok: false, reason: "unknown_channel" };
}

async function drain() {
  const rows = await fetchPending();
  let sent = 0;
  let failed = 0;
  const errors: { id: string; reason: string }[] = [];

  for (const row of rows) {
    const r = await deliver(row);
    if (r.ok) {
      await markSent(row.id);
      sent += 1;
    } else {
      await markFailed(row.id, r.reason ?? "unknown");
      failed += 1;
      errors.push({ id: row.id, reason: r.reason ?? "unknown" });
    }
  }
  return { pending: rows.length, sent, failed, errors };
}

export async function GET(req: NextRequest) {
  if (!authorized(req)) {
    return jsonErr(401, "unauthorized", "Missing cron secret");
  }
  const result = await drain();
  return jsonOk(result);
}

export async function POST(req: NextRequest) {
  if (!authorized(req)) {
    return jsonErr(401, "unauthorized", "Missing cron secret");
  }
  const result = await drain();
  return jsonOk(result);
}
