/**
 * Channel-specific renderers for outbox payloads.
 *
 * Every payload row written by `dispatch.ts` looks like
 *   { kind, ...kindSpecificFields }
 * (plus whatever the caller passed in). The renderer for each (channel,
 * locale, kind) tuple turns that into a concrete (subject, body) pair
 * — email-html + telegram-text.
 *
 * Kept tiny on purpose: no markdown library, no template engine. If we
 * need richer email layouts later we can swap to a proper template
 * module without changing this module's signature.
 */

export type RenderLocale = "uk" | "ru";

export interface EmailRendered {
  subject: string;
  html: string;
  text: string;
}

export interface TelegramRendered {
  text: string;
}

interface CommonPayload {
  kind?: string;
  dashboardUrl?: string;
  decision?: "approve" | "reject";
  notes?: string | null;
  productSlug?: string;
  amount?: number;
  currency?: string;
  lessonTitle?: string;
  body?: string;
  title?: string;
}

function readCommon(payload: Record<string, unknown>): CommonPayload {
  return {
    kind: typeof payload.kind === "string" ? payload.kind : undefined,
    dashboardUrl:
      typeof payload.dashboardUrl === "string" ? payload.dashboardUrl : undefined,
    decision:
      payload.decision === "approve" || payload.decision === "reject"
        ? payload.decision
        : undefined,
    notes: typeof payload.notes === "string" ? payload.notes : null,
    productSlug:
      typeof payload.productSlug === "string" ? payload.productSlug : undefined,
    amount: typeof payload.amount === "number" ? payload.amount : undefined,
    currency: typeof payload.currency === "string" ? payload.currency : undefined,
    lessonTitle:
      typeof payload.lessonTitle === "string" ? payload.lessonTitle : undefined,
    body: typeof payload.body === "string" ? payload.body : undefined,
    title: typeof payload.title === "string" ? payload.title : undefined,
  };
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function htmlOf(text: string, dashboardUrl?: string): string {
  const safe = escapeHtml(text).replace(/\n/g, "<br>");
  const cta = dashboardUrl
    ? `<p style="margin-top:24px"><a href="${escapeHtml(dashboardUrl)}" style="color:#0a0a0a;background:#f5f5f4;padding:10px 18px;border-radius:9999px;text-decoration:none;display:inline-block">Відкрити кабінет</a></p>`
    : "";
  return `<div style="font-family:Inter,system-ui,sans-serif;font-size:15px;line-height:1.55;color:#0a0a0a;max-width:560px">${safe}${cta}</div>`;
}

export function renderEmail(
  locale: RenderLocale,
  payload: Record<string, unknown>,
): EmailRendered {
  const p = readCommon(payload);
  const kind = p.kind ?? "system.info";

  if (kind === "case.approved") {
    const subject =
      locale === "ru"
        ? "Кейс одобрен — RESOUL"
        : "Кейс схвалено — RESOUL";
    const text =
      locale === "ru"
        ? `Привет!\n\nТвой кейс одобрен — сертификат уровня 2 готов. Загляни в кабинет, чтобы скачать.\n${p.notes ? `\nКомментарий ревьюера:\n${p.notes}\n` : ""}`
        : `Привіт!\n\nТвій кейс схвалено — сертифікат рівня 2 готовий. Загляни в кабінет, щоб завантажити.\n${p.notes ? `\nКоментар рев'юера:\n${p.notes}\n` : ""}`;
    return { subject, text, html: htmlOf(text, p.dashboardUrl) };
  }

  if (kind === "case.rejected") {
    const subject =
      locale === "ru"
        ? "Кейс отправлен на доработку — RESOUL"
        : "Кейс відправлено на доопрацювання — RESOUL";
    const text =
      locale === "ru"
        ? `Привет!\n\nРевьюер просит доработать кейс перед сертификацией.\n${p.notes ? `\nЧто посмотреть:\n${p.notes}\n` : ""}\nТы можешь отправить новую версию из кабинета.`
        : `Привіт!\n\nРев'юер просить доопрацювати кейс перед сертифікацією.\n${p.notes ? `\nЩо подивитись:\n${p.notes}\n` : ""}\nТи можеш відправити нову версію з кабінету.`;
    return { subject, text, html: htmlOf(text, p.dashboardUrl) };
  }

  if (kind === "payment.success") {
    const amount = p.amount ? ` (${p.amount} ${p.currency ?? "UAH"})` : "";
    const subject =
      locale === "ru"
        ? `Оплата получена${amount} — RESOUL`
        : `Оплату отримано${amount} — RESOUL`;
    const text =
      locale === "ru"
        ? `Привет!\n\nМы получили твою оплату${amount}. Доступ открыт — заходи в кабинет.`
        : `Привіт!\n\nМи отримали твою оплату${amount}. Доступ відкрито — заходь у кабінет.`;
    return { subject, text, html: htmlOf(text, p.dashboardUrl) };
  }

  if (kind === "lesson.unlocked") {
    const subject =
      locale === "ru"
        ? "Новый урок открыт — RESOUL"
        : "Новий урок відкрито — RESOUL";
    const text =
      locale === "ru"
        ? `Привет!\n\nНовый урок${p.lessonTitle ? ` «${p.lessonTitle}»` : ""} ждёт тебя в кабинете.`
        : `Привіт!\n\nНовий урок${p.lessonTitle ? ` «${p.lessonTitle}»` : ""} чекає тебе в кабінеті.`;
    return { subject, text, html: htmlOf(text, p.dashboardUrl) };
  }

  const subject = p.title ?? (locale === "ru" ? "RESOUL" : "RESOUL");
  const text = p.body ?? (locale === "ru" ? "Информация" : "Інформація");
  return { subject, text, html: htmlOf(text, p.dashboardUrl) };
}

export function renderTelegram(
  locale: RenderLocale,
  payload: Record<string, unknown>,
): TelegramRendered {
  const p = readCommon(payload);
  const kind = p.kind ?? "system.info";

  if (kind === "case.approved") {
    return {
      text:
        locale === "ru"
          ? `✅ Твой кейс одобрен. Сертификат уровня 2 в кабинете.${p.dashboardUrl ? `\n${p.dashboardUrl}` : ""}`
          : `✅ Твій кейс схвалено. Сертифікат рівня 2 в кабінеті.${p.dashboardUrl ? `\n${p.dashboardUrl}` : ""}`,
    };
  }
  if (kind === "case.rejected") {
    return {
      text:
        locale === "ru"
          ? `Ревьюер просит доработать кейс.${p.notes ? `\n\n${p.notes}` : ""}${p.dashboardUrl ? `\n\n${p.dashboardUrl}` : ""}`
          : `Рев'юер просить доопрацювати кейс.${p.notes ? `\n\n${p.notes}` : ""}${p.dashboardUrl ? `\n\n${p.dashboardUrl}` : ""}`,
    };
  }
  if (kind === "payment.success") {
    const amount = p.amount ? ` ${p.amount} ${p.currency ?? "UAH"}` : "";
    return {
      text:
        locale === "ru"
          ? `Оплата получена${amount}. Доступ открыт.${p.dashboardUrl ? `\n${p.dashboardUrl}` : ""}`
          : `Оплату отримано${amount}. Доступ відкрито.${p.dashboardUrl ? `\n${p.dashboardUrl}` : ""}`,
    };
  }
  if (kind === "lesson.unlocked") {
    return {
      text:
        locale === "ru"
          ? `Новый урок${p.lessonTitle ? ` «${p.lessonTitle}»` : ""} открыт.${p.dashboardUrl ? `\n${p.dashboardUrl}` : ""}`
          : `Новий урок${p.lessonTitle ? ` «${p.lessonTitle}»` : ""} відкрито.${p.dashboardUrl ? `\n${p.dashboardUrl}` : ""}`,
    };
  }

  return { text: p.body ?? (locale === "ru" ? "Уведомление" : "Сповіщення") };
}
