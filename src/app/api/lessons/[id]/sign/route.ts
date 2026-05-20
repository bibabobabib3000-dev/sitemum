import { NextRequest } from "next/server";
import { jsonErr, jsonOk } from "@/lib/api-response";
import { getSession } from "@/lib/auth/session";
import {
  canEnterCourse,
  ensureEnrollment,
  getEnrollment,
  getLessonById,
} from "@/lib/courses/access";
import { isUnlocked } from "@/lib/courses/drip";
import { isR2Configured, r2SignedGet } from "@/lib/storage/r2";

// Edge: Web Crypto signing only.
export const runtime = "edge";

const TTL_SEC = 60 * 60; // 1 hour

interface RouteContext {
  params: Promise<{ id: string }>;
}

export async function GET(_req: NextRequest, ctx: RouteContext) {
  const { id } = await ctx.params;
  if (!id || id.length > 64) {
    return jsonErr(400, "bad_id", "Invalid lesson id");
  }

  const session = await getSession();
  if (!session) {
    return jsonErr(401, "unauthorized", "Sign in to access this content");
  }

  const lesson = await getLessonById(id);
  if (!lesson) {
    return jsonErr(404, "not_found", "Lesson does not exist");
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

  if (!lesson.videoKey) {
    return jsonOk({ videoUrl: null });
  }
  if (!isR2Configured()) {
    return jsonErr(503, "r2_not_configured", "R2 storage is not configured");
  }

  const videoUrl = await r2SignedGet(lesson.videoKey, TTL_SEC);
  const audioUrl = lesson.audioKey
    ? await r2SignedGet(lesson.audioKey, TTL_SEC)
    : null;

  return jsonOk({ videoUrl, audioUrl, ttlSec: TTL_SEC });
}
