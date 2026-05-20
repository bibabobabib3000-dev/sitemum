import { getDb, isDbConfigured } from "@/lib/db";
import { isTelegramConfigured, sendMessage } from "./client";

export interface NewLeadInfo {
  userId: string | null;
  name: string;
  email: string;
  /** Telegram @username without the leading @ */
  telegram: string;
  productSlug: string;
  locale: "uk" | "ru";
  utm?: {
    source?: string;
    medium?: string;
    campaign?: string;
    content?: string;
    term?: string;
  };
  referer?: string;
}

function leadDmText(info: NewLeadInfo): string {
  if (info.locale === "ru") {
    return [
      `Привет, ${info.name}!`,
      ``,
      `Заявку на «${info.productSlug}» получили. В ближайшее время пришлю детали программы и ссылку на оплату.`,
      ``,
      `Если что — пиши прямо в этот чат.`,
    ].join("\n");
  }
  return [
    `Привіт, ${info.name}!`,
    ``,
    `Заявку на «${info.productSlug}» отримали. Найближчим часом надішлю деталі програми та посилання на оплату.`,
    ``,
    `Якщо щось — пиши прямо в цей чат.`,
  ].join("\n");
}

function adminText(info: NewLeadInfo): string {
  const utmPairs = info.utm
    ? Object.entries(info.utm)
        .filter(([, v]) => Boolean(v))
        .map(([k, v]) => `${k}=${v}`)
    : [];
  const lines = [
    `New lead: ${info.productSlug}`,
    `Name: ${info.name}`,
    `Email: ${info.email}`,
    `TG: @${info.telegram}`,
    `Locale: ${info.locale}`,
  ];
  if (utmPairs.length > 0) {
    lines.push(`UTM: ${utmPairs.join(", ")}`);
  }
  if (info.referer) {
    lines.push(`Ref: ${info.referer}`);
  }
  if (info.userId) {
    lines.push(`User id: ${info.userId}`);
  }
  return lines.join("\n");
}

async function findChatIdByUsername(username: string): Promise<number | null> {
  if (!isDbConfigured()) return null;
  const sql = getDb()!;
  try {
    const rows = (await sql`
      select tg_chat_id from tg_users
      where lower(tg_username) = lower(${username})
      order by started_at desc
      limit 1
    `) as { tg_chat_id: string | number }[];
    if (!rows[0]) return null;
    return Number(rows[0].tg_chat_id);
  } catch (err) {
    console.error("[tg:notify:lookup_error]", err);
    return null;
  }
}

/**
 * Best-effort DM to the lead. Requires the user to have previously sent
 * /start to the bot — otherwise we have no chat_id and return silently.
 */
export async function notifyLeadUser(info: NewLeadInfo): Promise<void> {
  if (!isTelegramConfigured()) return;
  const chatId = await findChatIdByUsername(info.telegram);
  if (chatId === null) {
    console.log("[tg:notify:dm_skipped]", {
      reason: "chat_id_unknown",
      telegram: info.telegram,
    });
    return;
  }
  const res = await sendMessage({
    chat_id: chatId,
    text: leadDmText(info),
    disable_web_page_preview: true,
  });
  if (!res.ok) {
    console.warn("[tg:notify:dm_failed]", res.description);
  }
}

/**
 * Optional admin notification. No-op unless TELEGRAM_ADMIN_CHAT_ID is set.
 */
export async function notifyLeadAdmin(info: NewLeadInfo): Promise<void> {
  if (!isTelegramConfigured()) return;
  const adminChatId = process.env.TELEGRAM_ADMIN_CHAT_ID;
  if (!adminChatId) return;
  const res = await sendMessage({
    chat_id: adminChatId,
    text: adminText(info),
    disable_web_page_preview: true,
  });
  if (!res.ok) {
    console.warn("[tg:notify:admin_failed]", res.description);
  }
}

/**
 * Fan out user + admin notifications without ever throwing into the caller.
 * Designed to be awaited inside the /api/lead handler — Promise.allSettled
 * means a Telegram outage cannot break lead capture.
 */
export async function notifyNewLead(info: NewLeadInfo): Promise<void> {
  await Promise.allSettled([notifyLeadUser(info), notifyLeadAdmin(info)]);
}

export interface EventReminderInfo {
  tgChatId: number;
  locale: "uk" | "ru";
  topic: string;
  startAtIso: string;
  joinUrl: string;
  minutesBefore: 60 | 15;
}

function eventReminderText(info: EventReminderInfo): string {
  const minutes = info.minutesBefore;
  const start = new Date(info.startAtIso)
    .toISOString()
    .replace("T", " ")
    .slice(0, 16);
  if (info.locale === "ru") {
    return [
      `${info.topic}`,
      ``,
      minutes === 60
        ? `Через час — ${start} UTC. Ссылка для входа в Zoom:`
        : `Через 15 минут — ${start} UTC. Заходи в Zoom прямо сейчас:`,
      info.joinUrl,
    ].join("\n");
  }
  return [
    `${info.topic}`,
    ``,
    minutes === 60
      ? `За годину — ${start} UTC. Посилання на Zoom:`
      : `За 15 хвилин — ${start} UTC. Заходь у Zoom уже зараз:`,
    info.joinUrl,
  ].join("\n");
}

/**
 * Sends a Zoom reminder DM. Returns true on confirmed Telegram success so
 * the cron job knows whether to flip reminder_*_sent_at.
 */
export async function notifyEventReminder(
  info: EventReminderInfo
): Promise<boolean> {
  if (!isTelegramConfigured()) return false;
  const res = await sendMessage({
    chat_id: info.tgChatId,
    text: eventReminderText(info),
    disable_web_page_preview: false,
  });
  if (!res.ok) {
    console.warn("[tg:notify:event_reminder_failed]", res.description);
    return false;
  }
  return true;
}
