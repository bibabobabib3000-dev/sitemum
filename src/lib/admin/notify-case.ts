import { getDb, isDbConfigured } from "@/lib/db";
import { isTelegramConfigured, sendMessage } from "@/lib/telegram/client";
import { isResendConfigured, sendEmail } from "@/lib/email/resend";

/**
 * Student-facing notification for a case-study decision.
 *
 * Wires the existing Telegram + Resend transports directly; once PR B3
 * lands a generic `dispatch.ts`, this module becomes a thin adapter
 * (or is replaced entirely). The contract here — best-effort, no
 * throwing into the caller — matches the lead-notification pattern so
 * the admin API can rely on Promise.allSettled.
 */

export type CaseDecisionLocale = "uk" | "ru";

export interface CaseDecisionRecipient {
  email: string;
  fullName: string | null;
  tgUsername: string | null;
  locale: CaseDecisionLocale;
}

export interface CaseDecisionPayload {
  decision: "approve" | "reject";
  /** Optional admin note; for reject we surface a sanitized excerpt. */
  notes: string | null;
  dashboardUrl: string;
}

interface RenderedCopy {
  subject: string;
  greeting: string;
  body: string;
  notesHeading: string | null;
  cta: string;
  fallback: string;
  signoff: string;
}

const APPROVE_COPY: Record<CaseDecisionLocale, RenderedCopy> = {
  uk: {
    subject: "Твій кейс RESOUL Level 2 — схвалено",
    greeting: "Вітаємо!",
    body:
      "Твою фінальну роботу за Level 2 розглянули і схвалили. Сертифікат уже доступний у кабінеті — заходь і завантажуй.",
    notesHeading: "Коментар куратора:",
    cta: "Відкрити кабінет",
    fallback: "Якщо кнопка не працює — відкрий посилання нижче:",
    signoff: "До зустрічі — команда RESOUL",
  },
  ru: {
    subject: "Твой кейс RESOUL Level 2 — одобрен",
    greeting: "Поздравляем!",
    body:
      "Твою финальную работу по Level 2 рассмотрели и одобрили. Сертификат уже доступен в кабинете — заходи и скачивай.",
    notesHeading: "Комментарий куратора:",
    cta: "Открыть кабинет",
    fallback: "Если кнопка не работает — открой ссылку ниже:",
    signoff: "До встречи — команда RESOUL",
  },
};

const REJECT_COPY: Record<CaseDecisionLocale, RenderedCopy> = {
  uk: {
    subject: "Твій кейс RESOUL Level 2 — потрібні правки",
    greeting: "Привіт,",
    body:
      "Ми розглянули твій кейс і поки не можемо його затвердити. У кабінеті можна оновити роботу і подати на повторний перегляд.",
    notesHeading: "Коментар куратора:",
    cta: "Відкрити кейс",
    fallback: "Якщо кнопка не працює — відкрий посилання нижче:",
    signoff: "До зв'язку — команда RESOUL",
  },
  ru: {
    subject: "Твой кейс RESOUL Level 2 — нужны правки",
    greeting: "Привет,",
    body:
      "Мы рассмотрели твой кейс и пока не можем его одобрить. В кабинете можно обновить работу и отправить на повторный просмотр.",
    notesHeading: "Комментарий куратора:",
    cta: "Открыть кейс",
    fallback: "Если кнопка не работает — открой ссылку ниже:",
    signoff: "До связи — команда RESOUL",
  },
};

function esc(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function renderCopy(payload: CaseDecisionPayload, locale: CaseDecisionLocale): RenderedCopy {
  return payload.decision === "approve" ? APPROVE_COPY[locale] : REJECT_COPY[locale];
}

function plainText(
  recipient: CaseDecisionRecipient,
  payload: CaseDecisionPayload,
): string {
  const copy = renderCopy(payload, recipient.locale);
  const lines: string[] = [];
  lines.push(copy.greeting);
  if (recipient.fullName) lines[0] = `${copy.greeting} ${recipient.fullName}`;
  lines.push("");
  lines.push(copy.body);
  if (payload.notes && copy.notesHeading) {
    lines.push("");
    lines.push(copy.notesHeading);
    lines.push(payload.notes);
  }
  lines.push("");
  lines.push(copy.cta + ": " + payload.dashboardUrl);
  lines.push("");
  lines.push(copy.signoff);
  return lines.join("\n");
}

function htmlBody(
  recipient: CaseDecisionRecipient,
  payload: CaseDecisionPayload,
): string {
  const copy = renderCopy(payload, recipient.locale);
  const greeting = recipient.fullName
    ? `${copy.greeting} ${recipient.fullName}`
    : copy.greeting;
  const notesBlock =
    payload.notes && copy.notesHeading
      ? `<p style="margin:0 0 16px; color:rgba(244,241,236,0.7); font-size:14px;"><strong>${esc(copy.notesHeading)}</strong></p>
            <blockquote style="margin:0 0 24px; padding:12px 16px; border-left:3px solid rgba(244,241,236,0.25); color:rgba(244,241,236,0.85); font-size:14px;">${esc(payload.notes)}</blockquote>`
      : "";

  return `<!doctype html>
<html lang="${recipient.locale}">
<head><meta charset="utf-8"><title>${esc(copy.subject)}</title></head>
<body style="margin:0; padding:0; background:#0f0f10; color:#f4f1ec; font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif; line-height:1.5;">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#0f0f10;">
  <tr><td align="center" style="padding:48px 24px;">
    <table role="presentation" width="480" cellpadding="0" cellspacing="0" style="max-width:480px; background:#161616; border:1px solid rgba(244,241,236,0.08); border-radius:24px;">
      <tr><td style="padding:40px 36px;">
        <p style="margin:0 0 24px; font-size:11px; letter-spacing:0.2em; text-transform:uppercase; color:rgba(244,241,236,0.55);">RESOUL · LEVEL 2</p>
        <h1 style="margin:0 0 12px; font-size:24px; font-weight:600; color:#f4f1ec;">${esc(greeting)}</h1>
        <p style="margin:0 0 24px; color:rgba(244,241,236,0.78); font-size:15px;">${esc(copy.body)}</p>
        ${notesBlock}
        <p style="margin:0 0 32px;"><a href="${esc(payload.dashboardUrl)}" style="display:inline-block; padding:14px 28px; background:#f4f1ec; color:#0f0f10; text-decoration:none; font-weight:600; border-radius:999px; font-size:15px;">${esc(copy.cta)}</a></p>
        <p style="margin:0 0 8px; color:rgba(244,241,236,0.5); font-size:13px;">${esc(copy.fallback)}</p>
        <p style="margin:0 0 24px; word-break:break-all;"><a href="${esc(payload.dashboardUrl)}" style="color:rgba(244,241,236,0.85); font-size:13px;">${esc(payload.dashboardUrl)}</a></p>
        <p style="margin:0; color:rgba(244,241,236,0.55); font-size:13px;">${esc(copy.signoff)}</p>
      </td></tr>
    </table>
  </td></tr>
</table>
</body>
</html>`;
}

function tgText(
  recipient: CaseDecisionRecipient,
  payload: CaseDecisionPayload,
): string {
  const copy = renderCopy(payload, recipient.locale);
  const greeting = recipient.fullName
    ? `${copy.greeting} ${recipient.fullName}`
    : copy.greeting;
  const lines = [greeting, "", copy.body];
  if (payload.notes && copy.notesHeading) {
    lines.push("", copy.notesHeading, payload.notes);
  }
  lines.push("", payload.dashboardUrl);
  return lines.join("\n");
}

async function findTgChatId(username: string | null): Promise<number | null> {
  if (!username || !isDbConfigured()) return null;
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
    console.error("[admin:cases:tg_lookup_error]", err);
    return null;
  }
}

export interface NotifyResult {
  email: { sent: boolean; error?: string };
  telegram: { sent: boolean; error?: string };
}

/**
 * Best-effort fan-out of a case decision to the student. Never throws —
 * the admin API layer logs the per-channel result and continues.
 */
export async function notifyCaseDecision(
  recipient: CaseDecisionRecipient,
  payload: CaseDecisionPayload,
): Promise<NotifyResult> {
  const subject = renderCopy(payload, recipient.locale).subject;

  const emailPromise: Promise<NotifyResult["email"]> = (async () => {
    if (!isResendConfigured()) return { sent: false, error: "resend_not_configured" };
    const res = await sendEmail({
      to: recipient.email,
      subject,
      html: htmlBody(recipient, payload),
      text: plainText(recipient, payload),
    });
    return res.ok ? { sent: true } : { sent: false, error: res.error };
  })();

  const tgPromise: Promise<NotifyResult["telegram"]> = (async () => {
    if (!isTelegramConfigured()) return { sent: false, error: "telegram_not_configured" };
    const chatId = await findTgChatId(recipient.tgUsername);
    if (chatId === null) return { sent: false, error: "no_chat_id" };
    const res = await sendMessage({
      chat_id: chatId,
      text: tgText(recipient, payload),
      disable_web_page_preview: true,
    });
    return res.ok ? { sent: true } : { sent: false, error: res.description };
  })();

  const [emailRes, tgRes] = await Promise.all([emailPromise, tgPromise]);
  return { email: emailRes, telegram: tgRes };
}

// Internal exports for tests.
export const __test = { plainText, tgText, htmlBody };
