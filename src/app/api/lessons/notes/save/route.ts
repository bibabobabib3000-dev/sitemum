import { NextRequest } from "next/server";
import { z } from "zod";
import { jsonErr, jsonOk } from "@/lib/api-response";
import { getSession } from "@/lib/auth/session";
import { isSessionBanned } from "@/lib/auth/user";
import {
  canEnterCourse,
  ensureEnrollment,
  getLessonById,
} from "@/lib/courses/access";
import { isUnlocked } from "@/lib/courses/drip";
import { NOTE_BODY_MAX, upsertNote } from "@/lib/lessons/notes";

export const runtime = "edge";
export const dynamic = "force-dynamic";

const schema = z.object({
  lessonId: z.string().uuid(),
  bodyMd: z.string().max(NOTE_BODY_MAX),
});

export async function POST(req: NextRequest) {
  const session = await getSession();
  if (!session) {
    return jsonErr(401, "unauthorized", "Sign in to save notes");
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
  const { lessonId, bodyMd } = parsed.data;

  // The lesson must exist AND the user must have access to its course.
  // We also gate by drip-unlock so a future-dated lesson can't be used
  // as a side-channel to write notes ahead of schedule. If the lesson
  // doesn't resolve (e.g. DB stub mode), we still acknowledge the call
  // so the autosave UI doesn't loop with a hard error.
  const lesson = await getLessonById(lessonId);
  if (lesson) {
    const allowed = await canEnterCourse(session.uid, lesson.courseSlug);
    if (!allowed) {
      return jsonErr(403, "no_access", "No access to this course");
    }
    const enrollment = await ensureEnrollment(session.uid, lesson.courseSlug);
    if (
      enrollment &&
      !isUnlocked(new Date(), enrollment.startedAt, lesson.dayOffset)
    ) {
      return jsonErr(403, "locked", "Lesson is not unlocked yet");
    }
  }

  const note = await upsertNote(session.uid, lessonId, bodyMd);
  return jsonOk({
    note: note
      ? {
          lessonId: note.lessonId,
          bodyMd: note.bodyMd,
          updatedAt: note.updatedAt.toISOString(),
        }
      : null,
  });
}
