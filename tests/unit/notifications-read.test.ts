import { describe, it, expect, beforeEach, vi } from "vitest";

beforeEach(() => {
  vi.resetModules();
  vi.doUnmock("@/lib/db");
});

describe("notifications read (stub mode)", () => {
  it("returns zero/empty when DB is not configured", async () => {
    vi.doMock("@/lib/db", () => ({
      isDbConfigured: () => false,
      getDb: () => null,
    }));
    const m = await import("@/lib/notifications/read");
    expect(await m.countUnread("u1")).toBe(0);
    expect(await m.listNotifications("u1")).toEqual([]);
    expect(await m.markRead("u1", "n1")).toBe(false);
    expect(await m.markAllRead("u1")).toBe(0);
  });
});

describe("countUnread (live)", () => {
  it("returns the row count", async () => {
    vi.doMock("@/lib/db", () => ({
      isDbConfigured: () => true,
      getDb: () => () => Promise.resolve([{ n: 7 }]),
    }));
    const { countUnread } = await import("@/lib/notifications/read");
    expect(await countUnread("u1")).toBe(7);
  });

  it("returns 0 when no rows", async () => {
    vi.doMock("@/lib/db", () => ({
      isDbConfigured: () => true,
      getDb: () => () => Promise.resolve([]),
    }));
    const { countUnread } = await import("@/lib/notifications/read");
    expect(await countUnread("u1")).toBe(0);
  });
});

describe("listNotifications (live)", () => {
  it("maps payload objects and dates", async () => {
    const sql = () =>
      Promise.resolve([
        {
          id: "n1",
          kind: "case.approved",
          payload: { dashboardUrl: "https://x" },
          read_at: null,
          created_at: "2025-02-01T10:00:00Z",
        },
        {
          id: "n2",
          kind: "system.info",
          payload: null,
          read_at: "2025-02-01T11:00:00Z",
          created_at: "2025-01-31T10:00:00Z",
        },
      ]);
    vi.doMock("@/lib/db", () => ({
      isDbConfigured: () => true,
      getDb: () => sql,
    }));
    const { listNotifications } = await import("@/lib/notifications/read");
    const items = await listNotifications("u1");
    expect(items).toHaveLength(2);
    expect(items[0].kind).toBe("case.approved");
    expect(items[0].payload.dashboardUrl).toBe("https://x");
    expect(items[0].readAt).toBeNull();
    expect(items[0].createdAt).toBeInstanceOf(Date);
    expect(items[1].payload).toEqual({});
    expect(items[1].readAt).toBeInstanceOf(Date);
  });

  it("guards against non-object payloads", async () => {
    const sql = () =>
      Promise.resolve([
        {
          id: "n1",
          kind: "x",
          payload: ["not", "an", "object"],
          read_at: null,
          created_at: "2025-02-01T10:00:00Z",
        },
      ]);
    vi.doMock("@/lib/db", () => ({
      isDbConfigured: () => true,
      getDb: () => sql,
    }));
    const { listNotifications } = await import("@/lib/notifications/read");
    const items = await listNotifications("u1");
    expect(items[0].payload).toEqual({});
  });
});

describe("markRead / markAllRead (live)", () => {
  it("markRead returns true when a row was updated", async () => {
    const sql = () => Promise.resolve([{ id: "n1" }]);
    vi.doMock("@/lib/db", () => ({
      isDbConfigured: () => true,
      getDb: () => sql,
    }));
    const { markRead } = await import("@/lib/notifications/read");
    expect(await markRead("u1", "n1")).toBe(true);
  });

  it("markRead returns false when nothing matched", async () => {
    vi.doMock("@/lib/db", () => ({
      isDbConfigured: () => true,
      getDb: () => () => Promise.resolve([]),
    }));
    const { markRead } = await import("@/lib/notifications/read");
    expect(await markRead("u1", "n1")).toBe(false);
  });

  it("markAllRead returns the number of cleared rows", async () => {
    vi.doMock("@/lib/db", () => ({
      isDbConfigured: () => true,
      getDb: () => () => Promise.resolve([{ id: "n1" }, { id: "n2" }, { id: "n3" }]),
    }));
    const { markAllRead } = await import("@/lib/notifications/read");
    expect(await markAllRead("u1")).toBe(3);
  });
});
