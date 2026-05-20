import type {
  TgGetMeResult,
  TgResponse,
} from "./types";

const API_BASE = "https://api.telegram.org";

export function isTelegramConfigured(): boolean {
  return Boolean(process.env.TELEGRAM_BOT_TOKEN);
}

export interface SendMessageParams {
  chat_id: number | string;
  text: string;
  parse_mode?: "HTML" | "Markdown" | "MarkdownV2";
  disable_web_page_preview?: boolean;
  disable_notification?: boolean;
  reply_to_message_id?: number;
  reply_markup?: unknown;
}

export interface SetWebhookParams {
  url: string;
  secret_token?: string;
  allowed_updates?: string[];
  drop_pending_updates?: boolean;
  max_connections?: number;
}

/**
 * Low-level Bot API call. Returns the parsed Telegram response envelope.
 * Never throws — network/parse errors are returned as `{ ok: false, description }`
 * so callers can decide whether to log or ignore.
 */
export async function callTelegram<T>(
  method: string,
  body?: object
): Promise<TgResponse<T>> {
  const token = process.env.TELEGRAM_BOT_TOKEN;
  if (!token) {
    return { ok: false, description: "TELEGRAM_BOT_TOKEN is not set" };
  }
  try {
    const res = await fetch(`${API_BASE}/bot${token}/${method}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: body ? JSON.stringify(body) : undefined,
      cache: "no-store",
    });
    return (await res.json()) as TgResponse<T>;
  } catch (err) {
    return {
      ok: false,
      description: err instanceof Error ? err.message : "fetch failed",
    };
  }
}

export function sendMessage(params: SendMessageParams) {
  return callTelegram<unknown>("sendMessage", params);
}

export function getMe() {
  return callTelegram<TgGetMeResult>("getMe");
}

export function setWebhook(params: SetWebhookParams) {
  return callTelegram<boolean>("setWebhook", params);
}

export function deleteWebhook(dropPending = false) {
  return callTelegram<boolean>("deleteWebhook", {
    drop_pending_updates: dropPending,
  });
}

export function getWebhookInfo() {
  return callTelegram<unknown>("getWebhookInfo");
}
