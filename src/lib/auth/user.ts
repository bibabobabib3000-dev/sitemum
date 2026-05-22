import { getDb, isDbConfigured } from "@/lib/db";
import { getSession, type SessionPayload } from "@/lib/auth/session";

/**
 * Notification channel toggles persisted in `users.notification_prefs`.
 * Stored as jsonb so we can add channels without a schema change; the
 * current product surface only reads/writes these three.
 */
export interface NotificationPrefs {
  email: boolean;
  telegram: boolean;
  in_app: boolean;
}

export type ThemePref = "system" | "dark" | "light";

/**
 * The shape returned by `getCurrentUser`. Mirrors `users.*` columns we
 * surface in the `/[locale]/account` form. Sensitive admin-only fields
 * (is_admin, banned_at, ban_reason) are exposed read-only so the layout
 * can decide whether to render a banner, but never written from this
 * surface.
 */
export interface CurrentUser {
  id: string;
  email: string;
  fullName: string | null;
  displayName: string | null;
  bio: string | null;
  locale: "uk" | "ru";
  tz: string | null;
  notificationPrefs: NotificationPrefs;
  themePref: ThemePref;
  avatarKey: string | null;
  isAdmin: boolean;
  bannedAt: Date | null;
  banReason: string | null;
}

interface CurrentUserRow {
  id: string;
  email: string;
  full_name: string | null;
  display_name: string | null;
  bio: string | null;
  locale: string;
  tz: string | null;
  notification_prefs: unknown;
  theme_pref: string | null;
  avatar_key: string | null;
  is_admin: boolean;
  banned_at: string | Date | null;
  ban_reason: string | null;
}

const DEFAULT_NOTIFICATION_PREFS: NotificationPrefs = {
  email: true,
  telegram: true,
  in_app: true,
};

function parseNotificationPrefs(raw: unknown): NotificationPrefs {
  if (!raw || typeof raw !== "object") return DEFAULT_NOTIFICATION_PREFS;
  const obj = raw as Record<string, unknown>;
  return {
    email: typeof obj.email === "boolean" ? obj.email : true,
    telegram: typeof obj.telegram === "boolean" ? obj.telegram : true,
    in_app: typeof obj.in_app === "boolean" ? obj.in_app : true,
  };
}

function parseThemePref(raw: string | null): ThemePref {
  return raw === "dark" || raw === "light" ? raw : "system";
}

function toDate(v: string | Date | null): Date | null {
  if (v === null) return null;
  return v instanceof Date ? v : new Date(v);
}

function rowToCurrentUser(r: CurrentUserRow): CurrentUser {
  return {
    id: r.id,
    email: r.email,
    fullName: r.full_name,
    displayName: r.display_name,
    bio: r.bio,
    locale: r.locale === "ru" ? "ru" : "uk",
    tz: r.tz,
    notificationPrefs: parseNotificationPrefs(r.notification_prefs),
    themePref: parseThemePref(r.theme_pref),
    avatarKey: r.avatar_key,
    isAdmin: r.is_admin === true,
    bannedAt: toDate(r.banned_at),
    banReason: r.ban_reason,
  };
}

/**
 * Resolves the current cookie session into a full `CurrentUser` record.
 *
 * Returns `null` when:
 *   - there is no session cookie (caller should redirect to /login),
 *   - the DB is not configured (the entire user surface is off), or
 *   - the user referenced by the session no longer exists (cookie stale).
 *
 * The function does NOT enforce ban state — callers decide whether a
 * banned user is allowed to read the page. Use `userIsBanned(user)` for
 * the boolean and `getBanGate(...)` from the layout for the redirect.
 */
export async function getCurrentUser(): Promise<CurrentUser | null> {
  const session = await getSession();
  if (!session) return null;
  return getUserById(session.uid);
}

export async function getUserById(userId: string): Promise<CurrentUser | null> {
  if (!isDbConfigured()) return null;
  const sql = getDb()!;
  const rows = (await sql`
    select
      id,
      email,
      full_name,
      display_name,
      bio,
      locale,
      tz,
      notification_prefs,
      theme_pref,
      avatar_key,
      is_admin,
      banned_at,
      ban_reason
    from users
    where id = ${userId}::uuid
    limit 1
  `) as CurrentUserRow[];
  const row = rows[0];
  if (!row) return null;
  return rowToCurrentUser(row);
}

/**
 * True when the user account is currently banned (soft-ban marker set).
 * Centralised here so the dashboard layout, account page and verify
 * route share the exact same predicate.
 */
export function userIsBanned(user: Pick<CurrentUser, "bannedAt"> | null): boolean {
  return user !== null && user.bannedAt !== null;
}

/**
 * Light-weight session check that only confirms whether the cookie owner
 * is banned. Avoids fetching the full profile when callers only need the
 * boolean (e.g. an API route).
 */
export async function isSessionBanned(): Promise<boolean> {
  const session = await getSession();
  if (!session) return false;
  if (!isDbConfigured()) return false;
  const sql = getDb()!;
  const rows = (await sql`
    select 1
    from users
    where id = ${session.uid}::uuid
      and banned_at is not null
    limit 1
  `) as unknown[];
  return rows.length > 0;
}

export interface UpdateProfileInput {
  displayName: string | null;
  bio: string | null;
  locale: "uk" | "ru";
  tz: string | null;
  notificationPrefs: NotificationPrefs;
  themePref: ThemePref;
}

/**
 * Persist the editable subset of profile fields. Returns the fresh row
 * so callers can echo the canonical state back to the client.
 *
 * The function is intentionally narrow — it does NOT accept admin-only
 * columns (is_admin, banned_at, ban_reason, email). The /api/account/*
 * surface and the admin surface stay completely separate.
 */
export async function updateProfile(
  userId: string,
  input: UpdateProfileInput,
): Promise<CurrentUser | null> {
  if (!isDbConfigured()) return null;
  const sql = getDb()!;
  const prefs = JSON.stringify({
    email: input.notificationPrefs.email,
    telegram: input.notificationPrefs.telegram,
    in_app: input.notificationPrefs.in_app,
  });
  const rows = (await sql`
    update users
    set
      display_name = ${input.displayName},
      bio = ${input.bio},
      locale = ${input.locale},
      tz = ${input.tz},
      notification_prefs = ${prefs}::jsonb,
      theme_pref = ${input.themePref},
      updated_at = now()
    where id = ${userId}::uuid
    returning
      id,
      email,
      full_name,
      display_name,
      bio,
      locale,
      tz,
      notification_prefs,
      theme_pref,
      avatar_key,
      is_admin,
      banned_at,
      ban_reason
  `) as CurrentUserRow[];
  const row = rows[0];
  if (!row) return null;
  return rowToCurrentUser(row);
}

export type { SessionPayload };
