import { describe, it, expect, beforeEach, vi } from "vitest";

beforeEach(() => {
  vi.resetModules();
  vi.doUnmock("@/lib/db");
});

describe("notify (stub mode)", () => {
  it("returns an empty result and writes nothing when DB is not configured", async () => {
    vi.doMock("@/lib/db", () => ({
      isDbConfigured: () => false,
      getDb: () => null,
    }));
    const { notify } = await import("@/lib/notifications/dispatch");
    const r = await notify({
      userId: "u1",
      kind: "case.approved",
      payload: { dashboardUrl: "https://x" },
    });
    expect(r.inAppId).toBeNull();
    expect(r.outboxIds).toEqual([]);
    expect(r.effectiveChannels).toEqual([]);
  });
});

describe("notify (live)", () => {
  function mockDbWith(prefs: { email: boolean; telegram: boolean; in_app: boolean } | null) {
    const calls: { sql: string; values: unknown[] }[] = [];
    let nextId = 1;
    const sql = (strings: TemplateStringsArray, ...values: unknown[]) => {
      const text = strings.join("?");
      calls.push({ sql: text, values });
      if (text.includes("select notification_prefs")) {
        return Promise.resolve(prefs === null ? [] : [{ notification_prefs: prefs }]);
      }
      if (text.includes("insert into notifications")) {
        return Promise.resolve([{ id: `in_app_${nextId++}` }]);
      }
      if (text.includes("insert into outbox")) {
        return Promise.resolve([{ id: `outbox_${nextId++}` }]);
      }
      return Promise.resolve([]);
    };
    vi.doMock("@/lib/db", () => ({
      isDbConfigured: () => true,
      getDb: () => sql,
    }));
    return { calls };
  }

  it("writes in_app + email + telegram when user opted into everything", async () => {
    const { calls } = mockDbWith({ email: true, telegram: true, in_app: true });
    const { notify } = await import("@/lib/notifications/dispatch");
    const r = await notify({
      userId: "u1",
      kind: "case.approved",
      payload: { dashboardUrl: "https://x", notes: "good job" },
    });
    expect(r.effectiveChannels.sort()).toEqual(["email", "in_app", "telegram"].sort());
    expect(r.inAppId).toBe("in_app_1");
    expect(r.outboxIds).toHaveLength(2);
    const inserts = calls.filter((c) => c.sql.includes("insert into"));
    expect(inserts).toHaveLength(3);
  });

  it("respects user prefs: in_app=false drops the in_app row", async () => {
    mockDbWith({ email: true, telegram: true, in_app: false });
    const { notify } = await import("@/lib/notifications/dispatch");
    const r = await notify({ userId: "u1", kind: "case.approved" });
    expect(r.effectiveChannels).not.toContain("in_app");
    expect(r.inAppId).toBeNull();
  });

  it("respects caller's channel restriction (in_app only)", async () => {
    const { calls } = mockDbWith({ email: true, telegram: true, in_app: true });
    const { notify } = await import("@/lib/notifications/dispatch");
    const r = await notify({
      userId: "u1",
      kind: "case.approved",
      channels: ["in_app"],
    });
    expect(r.effectiveChannels).toEqual(["in_app"]);
    expect(r.inAppId).not.toBeNull();
    expect(r.outboxIds).toEqual([]);
    const inserts = calls.filter((c) => c.sql.includes("insert into"));
    expect(inserts).toHaveLength(1); // only the in_app notifications row
    expect(inserts[0].sql).toMatch(/insert into notifications/);
  });

  it("uses fallback prefs (everything enabled) when no user row matches", async () => {
    mockDbWith(null);
    const { notify } = await import("@/lib/notifications/dispatch");
    const r = await notify({ userId: "u1", kind: "case.approved" });
    expect(r.effectiveChannels.sort()).toEqual(["email", "in_app", "telegram"].sort());
  });

  it("returns empty result when intersection is empty", async () => {
    mockDbWith({ email: false, telegram: false, in_app: false });
    const { notify } = await import("@/lib/notifications/dispatch");
    const r = await notify({ userId: "u1", kind: "case.approved" });
    expect(r.effectiveChannels).toEqual([]);
    expect(r.inAppId).toBeNull();
    expect(r.outboxIds).toEqual([]);
  });
});

describe("isNotificationKind", () => {
  it("accepts known kinds", async () => {
    const { isNotificationKind } = await import("@/lib/notifications/dispatch");
    expect(isNotificationKind("case.approved")).toBe(true);
    expect(isNotificationKind("payment.success")).toBe(true);
    expect(isNotificationKind("lesson.unlocked")).toBe(true);
  });
  it("rejects unknown kinds", async () => {
    const { isNotificationKind } = await import("@/lib/notifications/dispatch");
    expect(isNotificationKind("foo.bar")).toBe(false);
  });
});
