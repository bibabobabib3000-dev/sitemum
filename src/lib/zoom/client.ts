import { getZoomAccessToken, isZoomConfigured } from "./oauth";

const BASE = "https://api.zoom.us/v2";

export interface ZoomMeeting {
  id: number;
  topic: string;
  start_time: string;
  duration: number;
  join_url: string;
  start_url: string;
}

async function zoomFetch<T>(
  path: string,
  init: RequestInit & { json?: unknown } = {}
): Promise<T> {
  if (!isZoomConfigured()) {
    throw new Error("Zoom not configured");
  }
  const token = await getZoomAccessToken();
  const headers = new Headers(init.headers);
  headers.set("Authorization", `Bearer ${token}`);
  if (init.json !== undefined) headers.set("Content-Type", "application/json");

  const res = await fetch(`${BASE}${path}`, {
    ...init,
    headers,
    body: init.json !== undefined ? JSON.stringify(init.json) : init.body,
  });

  if (!res.ok) {
    const body = await res.text().catch(() => "");
    throw new Error(`Zoom ${path} ${res.status}: ${body}`);
  }
  return (await res.json()) as T;
}

/**
 * Create a scheduled meeting on the "me" host (the Server-to-Server OAuth
 * app's primary user). Used by admin tooling — not invoked by the runtime
 * landing flow.
 */
export async function createMeeting(opts: {
  topic: string;
  /** RFC 3339 start time. */
  start_time: string;
  /** Duration in minutes. */
  duration: number;
  /** Optional timezone (e.g. "Europe/Kyiv"). */
  timezone?: string;
}): Promise<ZoomMeeting> {
  return zoomFetch<ZoomMeeting>("/users/me/meetings", {
    method: "POST",
    json: {
      topic: opts.topic,
      type: 2, // scheduled
      start_time: opts.start_time,
      duration: opts.duration,
      timezone: opts.timezone,
      settings: {
        approval_type: 0, // automatic
        join_before_host: false,
        waiting_room: true,
      },
    },
  });
}

export async function getMeeting(id: string | number): Promise<ZoomMeeting> {
  return zoomFetch<ZoomMeeting>(`/meetings/${id}`);
}
