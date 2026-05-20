import { NextRequest } from "next/server";
import { jsonErr, jsonOk } from "@/lib/api-response";
import { isDbConfigured } from "@/lib/db";
import {
  getPendingReminders,
  markReminderSent,
  type PendingReminderRow,
} from "@/lib/events/repo";
import { isTelegramConfigured } from "@/lib/telegram/client";
import { notifyEventReminder } from "@/lib/telegram/notify";

export const runtime = "edge";

// Vercel's hobby tier cron minimum interval is 5 minutes; use half-window of
// 3 minutes so a 60-min-out reminder fires in [57..63] and a 15-min-out one
// in [12..18]. Each attendee gets each reminder exactly once because the
// "sent_at" column is set after dispatch.
const WINDOW_MIN = 3;

function authorized(req: NextRequest): boolean {
  const expected = process.env.CRON_SECRET?.trim();
  // No secret set -> only allow when running inside Vercel cron (which sets
  // the special `x-vercel-cron` header). For local development a curl with
  // no secret and no header is rejected.
  if (!expected) {
    return req.headers.get("x-vercel-cron") !== null;
  }
  const header = req.headers.get("authorization") ?? "";
  return header === `Bearer ${expected}`;
}

async function dispatch(which: 60 | 15) {
  const pending = await getPendingReminders({ which, windowMin: WINDOW_MIN });
  let sent = 0;
  let skipped = 0;

  for (const row of pending) {
    if (await tryNotify(row, which)) {
      sent += 1;
    } else {
      skipped += 1;
    }
    await markReminderSent({
      which,
      eventId: row.eventId,
      userId: row.userId,
    });
  }
  return { pending: pending.length, sent, skipped };
}

async function tryNotify(
  row: PendingReminderRow,
  minutesBefore: 60 | 15
): Promise<boolean> {
  if (!isTelegramConfigured()) return false;
  if (row.userTgId === null) return false;
  if (!row.joinUrl) return false;
  const topic = row.userLocale === "ru" && row.topicRu ? row.topicRu : row.topicUk;
  try {
    return await notifyEventReminder({
      tgChatId: row.userTgId,
      locale: row.userLocale,
      topic,
      startAtIso: row.startAt,
      joinUrl: row.joinUrl,
      minutesBefore,
    });
  } catch (err) {
    console.warn("[cron:zoom-reminders:notify_error]", err);
    return false;
  }
}

async function run(req: NextRequest) {
  if (!authorized(req)) {
    return jsonErr(401, "unauthorized", "Cron secret missing or invalid");
  }
  if (!isDbConfigured()) {
    return jsonOk({ ran: false, reason: "no_database" });
  }
  const sixty = await dispatch(60);
  const fifteen = await dispatch(15);
  return jsonOk({ ran: true, sixty, fifteen });
}

export async function GET(req: NextRequest) {
  return run(req);
}

export async function POST(req: NextRequest) {
  return run(req);
}
