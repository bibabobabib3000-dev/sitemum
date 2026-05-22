import { describe, it, expect, beforeEach, vi } from "vitest";

beforeEach(() => {
  vi.resetModules();
  vi.doUnmock("@/lib/db");
});

describe("isUserBanned (magic-link)", () => {
  it("returns false when DB is not configured", async () => {
    vi.doMock("@/lib/db", () => ({
      isDbConfigured: () => false,
      getDb: () => null,
    }));
    const { isUserBanned } = await import("@/lib/auth/magic-link");
    expect(await isUserBanned("u1")).toBe(false);
  });

  it("returns true when a row with banned_at exists", async () => {
    const sql = () => Promise.resolve([{ "?column?": 1 }]);
    vi.doMock("@/lib/db", () => ({
      isDbConfigured: () => true,
      getDb: () => sql,
    }));
    const { isUserBanned } = await import("@/lib/auth/magic-link");
    expect(await isUserBanned("u1")).toBe(true);
  });

  it("returns false when no row matches the filter", async () => {
    const sql = () => Promise.resolve([]);
    vi.doMock("@/lib/db", () => ({
      isDbConfigured: () => true,
      getDb: () => sql,
    }));
    const { isUserBanned } = await import("@/lib/auth/magic-link");
    expect(await isUserBanned("u1")).toBe(false);
  });

  it("filters by user id and banned_at is not null", async () => {
    const captured: { strings: TemplateStringsArray; values: unknown[] }[] = [];
    const sql = (strings: TemplateStringsArray, ...values: unknown[]) => {
      captured.push({ strings, values });
      return Promise.resolve([]);
    };
    vi.doMock("@/lib/db", () => ({
      isDbConfigured: () => true,
      getDb: () => sql,
    }));
    const { isUserBanned } = await import("@/lib/auth/magic-link");
    await isUserBanned("11111111-1111-1111-1111-111111111111");
    expect(captured).toHaveLength(1);
    const fullText = captured[0].strings.join("?");
    expect(fullText).toContain("from users");
    expect(fullText).toContain("banned_at is not null");
    expect(captured[0].values[0]).toBe(
      "11111111-1111-1111-1111-111111111111",
    );
  });
});
