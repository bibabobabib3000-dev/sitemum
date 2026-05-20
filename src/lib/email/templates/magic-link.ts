/**
 * Magic-link email body. We render plain HTML (not React Email) to avoid
 * adding heavy deps for a single template. Keep it semantic and as
 * email-client-safe as possible — no external CSS, no JS.
 */

export interface MagicLinkEmailInput {
  locale: "uk" | "ru";
  url: string;
}

interface Copy {
  subject: string;
  preheader: string;
  greeting: string;
  body: string;
  cta: string;
  fallback: string;
  signoff: string;
  ttlNote: string;
}

const COPY: Record<"uk" | "ru", Copy> = {
  uk: {
    subject: "Вхід у RESOUL",
    preheader: "Натисни кнопку, щоб увійти у свій кабінет.",
    greeting: "Привіт,",
    body:
      "Ти запросив вхід у RESOUL. Натисни на кнопку нижче — і ми відкриємо кабінет без пароля.",
    cta: "Увійти в RESOUL",
    fallback: "Якщо кнопка не працює — скопіюй це посилання у браузер:",
    signoff: "До зустрічі — команда RESOUL",
    ttlNote: "Посилання діє 30 хвилин і відкривається один раз.",
  },
  ru: {
    subject: "Вход в RESOUL",
    preheader: "Нажми кнопку, чтобы войти в свой кабинет.",
    greeting: "Привет,",
    body:
      "Ты запросил вход в RESOUL. Нажми кнопку ниже — и мы откроем кабинет без пароля.",
    cta: "Войти в RESOUL",
    fallback: "Если кнопка не работает — скопируй ссылку в браузер:",
    signoff: "До встречи — команда RESOUL",
    ttlNote: "Ссылка действует 30 минут и открывается один раз.",
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

export interface RenderedEmail {
  subject: string;
  html: string;
  text: string;
}

export function renderMagicLinkEmail(
  input: MagicLinkEmailInput
): RenderedEmail {
  const t = COPY[input.locale];
  const url = esc(input.url);

  const html = `<!doctype html>
<html lang="${input.locale}">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${esc(t.subject)}</title>
</head>
<body style="margin:0; padding:0; background:#0f0f10; color:#f4f1ec; font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif; line-height:1.5;">
<div style="display:none; max-height:0; overflow:hidden; color:transparent; font-size:1px;">${esc(t.preheader)}</div>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#0f0f10;">
  <tr>
    <td align="center" style="padding:48px 24px;">
      <table role="presentation" width="480" cellpadding="0" cellspacing="0" style="max-width:480px; background:#161616; border:1px solid rgba(244,241,236,0.08); border-radius:24px;">
        <tr>
          <td style="padding:40px 36px;">
            <p style="margin:0 0 24px; font-size:11px; letter-spacing:0.2em; text-transform:uppercase; color:rgba(244,241,236,0.55);">RESOUL</p>
            <h1 style="margin:0 0 12px; font-family:'Inter',sans-serif; font-size:24px; font-weight:600; color:#f4f1ec;">${esc(t.greeting)}</h1>
            <p style="margin:0 0 24px; color:rgba(244,241,236,0.75); font-size:15px;">${esc(t.body)}</p>
            <p style="margin:0 0 32px;">
              <a href="${url}" style="display:inline-block; padding:14px 28px; background:#f4f1ec; color:#0f0f10; text-decoration:none; font-weight:600; border-radius:999px; font-size:15px;">${esc(t.cta)}</a>
            </p>
            <p style="margin:0 0 8px; color:rgba(244,241,236,0.55); font-size:12px;">${esc(t.fallback)}</p>
            <p style="margin:0 0 24px; word-break:break-all; color:rgba(244,241,236,0.85); font-size:12px;"><a href="${url}" style="color:#9ec1ff; text-decoration:underline;">${url}</a></p>
            <p style="margin:0 0 16px; color:rgba(244,241,236,0.4); font-size:12px;">${esc(t.ttlNote)}</p>
            <hr style="border:none; border-top:1px solid rgba(244,241,236,0.08); margin:24px 0;">
            <p style="margin:0; color:rgba(244,241,236,0.55); font-size:12px;">${esc(t.signoff)}</p>
          </td>
        </tr>
      </table>
    </td>
  </tr>
</table>
</body>
</html>`;

  const text = [
    t.greeting,
    "",
    t.body,
    "",
    t.fallback,
    input.url,
    "",
    t.ttlNote,
    "",
    t.signoff,
  ].join("\n");

  return { subject: t.subject, html, text };
}
