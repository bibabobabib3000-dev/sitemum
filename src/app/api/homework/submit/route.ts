import { NextRequest } from "next/server";
import { z } from "zod";
import { jsonErr, jsonOk } from "@/lib/api-response";
import { getSession } from "@/lib/auth/session";
import {
  canEnterCourse,
  ensureEnrollment,
  getEnrollment,
  getLessonById,
  recordHomework,
} from "@/lib/courses/access";
import { isUnlocked } from "@/lib/courses/drip";

export const runtime = "edge";

const schema = z.object({
  lessonId: z.string().min(1).max(64),
  bodyText: z.string().max(10000).optional().nullable(),
  externalUrl: z.string().url().max(500).optional().nullable(),
  fileKeys: z.array(z.string().min(1).max(300)).max(5).optional().default([]),
});

export async function POST(req: NextRequest) {
  const session = await getSession();
  if (!session) {
    return jsonErr(401, "unauthorized", "Sign in to submit homework");
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
      z.treeifyError(parsed.error)
    );
  }
  const { lessonId, bodyText, externalUrl, fileKeys } = parsed.data;

  // Require at least one of: text, url, or file.
  if (
    (!bodyText || !bodyText.trim()) &&
    (!externalUrl || !externalUrl.trim()) &&
    fileKeys.length === 0
  ) {
    return jsonErr(422, "empty", "Provide text, link or file");
  }

  const lesson = await getLessonById(lessonId);
  if (!lesson) {
    return jsonErr(404, "no_lesson", "Lesson not found");
  }

  const allowed = await canEnterCourse(session.uid, lesson.courseSlug);
  if (!allowed) {
    return jsonErr(403, "no_access", "You do not own this course");
  }

  const enrollment =
    (await getEnrollment(session.uid, lesson.courseSlug)) ??
    (await ensureEnrollment(session.uid, lesson.courseSlug));
  if (!enrollment) {
    return jsonErr(500, "no_enrollment", "Could not create enrollment");
  }
  if (!isUnlocked(new Date(), enrollment.startedAt, lesson.dayOffset)) {
    return jsonErr(423, "locked", "Lesson is not yet unlocked");
  }

  const id = await recordHomework({
    userId: session.uid,
    lessonId,
    bodyText: bodyText?.trim() || null,
    externalUrl: externalUrl?.trim() || null,
    fileKeys,
  });
  if (!id) {
    return jsonErr(500, "no_persist", "Could not persist submission");
  }

  return jsonOk({ id });
}
