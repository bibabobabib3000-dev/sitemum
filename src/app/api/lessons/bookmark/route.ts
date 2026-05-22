import { NextRequest } from "next/server";
import { z } from "zod";
import { jsonErr, jsonOk } from "@/lib/api-response";
import { getSession } from "@/lib/auth/session";
import { isSessionBanned } from "@/lib/auth/user";
import {
  canEnterCourse,
  getLessonById,
} from "@/lib/courses/access";
import { setBookmark } from "@/lib/lessons/notes";

export const runtime = "edge";
export const dynamic = "force-dynamic";

const schema = z.object({
  lessonId: z.string().uuid(),
  bookmarked: z.boolean(),
});

export async function POST(req: NextRequest) {
  const session = await getSession();
  if (!session) {
    return jsonErr(401, "unauthorized", "Sign in to bookmark");
  }
  if (await isSessionBanned()) {
    return jsonErr(403, "banned", "Account is suspended");
  }

  let raw: unknown;
  try {
    raw = await req.json();
  } catch {
    return jsonErr(400, "invalid_json", "Body is not valid JSON");
  }
  const parsed = schema.safeParse(raw);
  if (!parsed.success) {
    return jsonErr(
      422,
      "invalid_input",
      "Invalid payload",
      z.treeifyError(parsed.error),
    );
  }
  const { lessonId, bookmarked } = parsed.data;

  // Same access rule as note-save, minus the drip-unlock check — a user
  // is allowed to bookmark a future-dated lesson they have access to so
  // they can come back to it later.
  const lesson = await getLessonById(lessonId);
  if (lesson) {
    const allowed = await canEnterCourse(session.uid, lesson.courseSlug);
    if (!allowed) {
      return jsonErr(403, "no_access", "No access to this course");
    }
  }

  const state = await setBookmark(session.uid, lessonId, bookmarked);
  return jsonOk({ bookmarked: state });
}
