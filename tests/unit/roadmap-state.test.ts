import { describe, it, expect, beforeEach, vi } from "vitest";

// Mock the DB module BEFORE importing the SUT so the SUT picks up the
// stubbed `isDbConfigured`/`getDb` symbols.
vi.mock("@/lib/db", () => ({
  isDbConfigured: () => false,
  getDb: () => null,
}));

beforeEach(() => {
  vi.resetModules();
});

describe("getRoadmap (stub mode, DB not configured)", () => {
  it("returns three milestones in canonical order, all locked", async () => {
    const { getRoadmap } = await import("@/lib/courses/roadmap-state");
    const ms = await getRoadmap("00000000-0000-0000-0000-000000000000");

    expect(ms).toHaveLength(3);
    expect(ms.map((m) => m.id)).toEqual(["level-0", "level-1", "level-2"]);
    for (const m of ms) {
      expect(m.state).toBe("locked");
      expect(m.lessonsTotal).toBe(0);
      expect(m.lessonsUnlocked).toBe(0);
      expect(m.homeworkDone).toBe(0);
    }
  });

  it("uses the catalog title for each milestone", async () => {
    const { getRoadmap } = await import("@/lib/courses/roadmap-state");
    const { CATALOG } = await import("@/lib/payments/catalog");
    const ms = await getRoadmap("00000000-0000-0000-0000-000000000000");

    expect(ms[0].title).toBe(CATALOG["level-0"].titleUk);
    expect(ms[1].title).toBe(CATALOG["level-1"].titleUk);
    expect(ms[2].title).toBe(CATALOG["level-2"].titleUk);
  });
});
