import { describe, it, expect, beforeEach, vi } from "vitest";

beforeEach(() => {
  vi.resetModules();
  vi.doUnmock("@/lib/db");
  vi.doUnmock("@/lib/auth/session");
});

describe("getCurrentUser", () => {
  it("returns null when there is no session", async () => {
    vi.doMock("@/lib/auth/session", () => ({
      getSession: async () => null,
    }));
    vi.doMock("@/lib/db", () => ({
      isDbConfigured: () => true,
      getDb: () => () => Promise.resolve([]),
    }));
    const { getCurrentUser } = await import("@/lib/auth/user");
    expect(await getCurrentUser()).toBeNull();
  });

  it("returns null when DB is not configured", async () => {
    vi.doMock("@/lib/auth/session", () => ({
      getSession: async () => ({
        uid: "u1",
        exp: Math.floor(Date.now() / 1000) + 3600,
      }),
    }));
    vi.doMock("@/lib/db", () => ({
      isDbConfigured: () => false,
      getDb: () => null,
    }));
    const { getCurrentUser } = await import("@/lib/auth/user");
    expect(await getCurrentUser()).toBeNull();
  });

  it("maps a live row into the typed CurrentUser shape with defaults", async () => {
    vi.doMock("@/lib/auth/session", () => ({
      getSession: async () => ({
        uid: "11111111-1111-1111-1111-111111111111",
        exp: Math.floor(Date.now() / 1000) + 3600,
      }),
    }));
    const sql = () =>
      Promise.resolve([
        {
          id: "11111111-1111-1111-1111-111111111111",
          email: "a@b.com",
          full_name: "Alice",
          display_name: null,
          bio: null,
          locale: "uk",
          tz: null,
          notification_prefs: null,
          theme_pref: null,
          avatar_key: null,
          is_admin: false,
          banned_at: null,
          ban_reason: null,
        },
      ]);
    vi.doMock("@/lib/db", () => ({
      isDbConfigured: () => true,
      getDb: () => sql,
    }));
    const { getCurrentUser } = await import("@/lib/auth/user");
    const user = await getCurrentUser();
    expect(user).not.toBeNull();
    expect(user!.email).toBe("a@b.com");
    expect(user!.locale).toBe("uk");
    expect(user!.themePref).toBe("system");
    expect(user!.notificationPrefs).toEqual({
      email: true,
      telegram: true,
      in_app: true,
    });
    expect(user!.bannedAt).toBeNull();
  });

  it("parses partial notification_prefs JSON and exotic theme value", async () => {
    vi.doMock("@/lib/auth/session", () => ({
      getSession: async () => ({
        uid: "u1",
        exp: Math.floor(Date.now() / 1000) + 3600,
      }),
    }));
    const sql = () =>
      Promise.resolve([
        {
          id: "u1",
          email: "x@y.com",
          full_name: null,
          display_name: "X",
          bio: "hi",
          locale: "ru",
          tz: "Europe/Kyiv",
          notification_prefs: { email: false, telegram: true },
          theme_pref: "weird",
          avatar_key: "k/abc.webp",
          is_admin: true,
          banned_at: null,
          ban_reason: null,
        },
      ]);
    vi.doMock("@/lib/db", () => ({
      isDbConfigured: () => true,
      getDb: () => sql,
    }));
    const { getCurrentUser } = await import("@/lib/auth/user");
    const user = await getCurrentUser();
    expect(user!.locale).toBe("ru");
    expect(user!.themePref).toBe("system");
    expect(user!.notificationPrefs).toEqual({
      email: false,
      telegram: true,
      in_app: true,
    });
    expect(user!.isAdmin).toBe(true);
  });
});

describe("userIsBanned", () => {
  it("returns false for null user", async () => {
    const { userIsBanned } = await import("@/lib/auth/user");
    expect(userIsBanned(null)).toBe(false);
  });

  it("returns false when bannedAt is null", async () => {
    const { userIsBanned } = await import("@/lib/auth/user");
    expect(userIsBanned({ bannedAt: null })).toBe(false);
  });

  it("returns true when bannedAt is a Date", async () => {
    const { userIsBanned } = await import("@/lib/auth/user");
    expect(userIsBanned({ bannedAt: new Date() })).toBe(true);
  });
});

describe("isSessionBanned", () => {
  it("returns false when no session", async () => {
    vi.doMock("@/lib/auth/session", () => ({
      getSession: async () => null,
    }));
    vi.doMock("@/lib/db", () => ({
      isDbConfigured: () => true,
      getDb: () => () => Promise.resolve([{ "?column?": 1 }]),
    }));
    const { isSessionBanned } = await import("@/lib/auth/user");
    expect(await isSessionBanned()).toBe(false);
  });

  it("returns false when DB is not configured", async () => {
    vi.doMock("@/lib/auth/session", () => ({
      getSession: async () => ({ uid: "u1", exp: 9999999999 }),
    }));
    vi.doMock("@/lib/db", () => ({
      isDbConfigured: () => false,
      getDb: () => null,
    }));
    const { isSessionBanned } = await import("@/lib/auth/user");
    expect(await isSessionBanned()).toBe(false);
  });

  it("returns true when a banned user row exists", async () => {
    vi.doMock("@/lib/auth/session", () => ({
      getSession: async () => ({ uid: "u1", exp: 9999999999 }),
    }));
    vi.doMock("@/lib/db", () => ({
      isDbConfigured: () => true,
      getDb: () => () => Promise.resolve([{ "?column?": 1 }]),
    }));
    const { isSessionBanned } = await import("@/lib/auth/user");
    expect(await isSessionBanned()).toBe(true);
  });

  it("returns false when no banned row matches", async () => {
    vi.doMock("@/lib/auth/session", () => ({
      getSession: async () => ({ uid: "u1", exp: 9999999999 }),
    }));
    vi.doMock("@/lib/db", () => ({
      isDbConfigured: () => true,
      getDb: () => () => Promise.resolve([]),
    }));
    const { isSessionBanned } = await import("@/lib/auth/user");
    expect(await isSessionBanned()).toBe(false);
  });
});

describe("updateProfile", () => {
  it("returns null when DB is not configured", async () => {
    vi.doMock("@/lib/db", () => ({
      isDbConfigured: () => false,
      getDb: () => null,
    }));
    const { updateProfile } = await import("@/lib/auth/user");
    const r = await updateProfile("u1", {
      displayName: "X",
      bio: null,
      locale: "uk",
      tz: null,
      notificationPrefs: { email: true, telegram: false, in_app: true },
      themePref: "dark",
    });
    expect(r).toBeNull();
  });

  it("returns the updated row when DB writes succeed", async () => {
    const sql = () =>
      Promise.resolve([
        {
          id: "u1",
          email: "u@x.com",
          full_name: null,
          display_name: "X",
          bio: null,
          locale: "ru",
          tz: "Europe/Kyiv",
          notification_prefs: {
            email: true,
            telegram: false,
            in_app: true,
          },
          theme_pref: "dark",
          avatar_key: null,
          is_admin: false,
          banned_at: null,
          ban_reason: null,
        },
      ]);
    vi.doMock("@/lib/db", () => ({
      isDbConfigured: () => true,
      getDb: () => sql,
    }));
    const { updateProfile } = await import("@/lib/auth/user");
    const r = await updateProfile("u1", {
      displayName: "X",
      bio: null,
      locale: "ru",
      tz: "Europe/Kyiv",
      notificationPrefs: { email: true, telegram: false, in_app: true },
      themePref: "dark",
    });
    expect(r).not.toBeNull();
    expect(r!.displayName).toBe("X");
    expect(r!.locale).toBe("ru");
    expect(r!.themePref).toBe("dark");
    expect(r!.notificationPrefs.telegram).toBe(false);
  });
});
