import { NextRequest } from "next/server";
import { z } from "zod";
import { jsonErr, jsonOk } from "@/lib/api-response";
import { getSession } from "@/lib/auth/session";
import {
  getUserById,
  updateProfile,
  userIsBanned,
} from "@/lib/auth/user";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const schema = z.object({
  display_name: z
    .string()
    .trim()
    .min(1)
    .max(120)
    .nullable(),
  bio: z.string().max(500).nullable(),
  locale: z.enum(["uk", "ru"]),
  tz: z
    .string()
    .max(64)
    .regex(/^[A-Za-z0-9_+\-/]+$/, "Invalid timezone identifier")
    .nullable(),
  notification_prefs: z.object({
    email: z.boolean(),
    telegram: z.boolean(),
    in_app: z.boolean(),
  }),
  theme_pref: z.enum(["system", "dark", "light"]),
});

export async function POST(req: NextRequest) {
  const session = await getSession();
  if (!session) {
    return jsonErr(401, "unauthenticated", "Sign in to update your profile");
  }

  // Ban gate also lives on the write path so a banned user who somehow
  // keeps a stale tab open can't mutate their own profile.
  const existing = await getUserById(session.uid);
  if (!existing) {
    return jsonErr(404, "not_found", "User not found");
  }
  if (userIsBanned(existing)) {
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

  const updated = await updateProfile(session.uid, {
    displayName: parsed.data.display_name,
    bio: parsed.data.bio,
    locale: parsed.data.locale,
    tz: parsed.data.tz,
    notificationPrefs: parsed.data.notification_prefs,
    themePref: parsed.data.theme_pref,
  });
  if (!updated) {
    return jsonErr(500, "update_failed", "Could not save profile");
  }

  return jsonOk({
    profile: {
      display_name: updated.displayName,
      bio: updated.bio,
      locale: updated.locale,
      tz: updated.tz,
      notification_prefs: updated.notificationPrefs,
      theme_pref: updated.themePref,
    },
  });
}
