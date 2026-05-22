import { NextRequest } from "next/server";
import { jsonErr, jsonOk } from "@/lib/api-response";
import { getSession } from "@/lib/auth/session";
import { countUnread, listNotifications } from "@/lib/notifications/read";

export const runtime = "edge";
export const dynamic = "force-dynamic";

const DEFAULT_LIMIT = 20;
const MAX_LIMIT = 100;

export async function GET(req: NextRequest) {
  const session = await getSession();
  if (!session) {
    return jsonErr(401, "unauthorized", "Sign in to read notifications");
  }

  const limitParam = req.nextUrl.searchParams.get("limit");
  let limit = DEFAULT_LIMIT;
  if (limitParam) {
    const parsed = Number.parseInt(limitParam, 10);
    if (Number.isFinite(parsed) && parsed > 0) {
      limit = Math.min(parsed, MAX_LIMIT);
    }
  }

  const [items, unread] = await Promise.all([
    listNotifications(session.uid, limit),
    countUnread(session.uid),
  ]);

  return jsonOk({
    unread,
    items: items.map((n) => ({
      id: n.id,
      kind: n.kind,
      payload: n.payload,
      readAt: n.readAt ? n.readAt.toISOString() : null,
      createdAt: n.createdAt.toISOString(),
    })),
  });
}
