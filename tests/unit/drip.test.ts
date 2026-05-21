import { describe, it, expect } from "vitest";

import { isUnlocked, unlockInfo } from "@/lib/courses/drip";

const MS_PER_DAY = 24 * 60 * 60 * 1000;

describe("isUnlocked", () => {
  const startedAt = new Date("2026-01-01T00:00:00Z");

  it("unlocks day-0 immediately at enrollment time", () => {
    expect(isUnlocked(startedAt, startedAt, 0)).toBe(true);
  });

  it("does not unlock day-1 one minute after enrollment", () => {
    const oneMinuteLater = new Date(startedAt.getTime() + 60_000);
    expect(isUnlocked(oneMinuteLater, startedAt, 1)).toBe(false);
  });

  it("unlocks day-1 exactly 24h after enrollment", () => {
    const exactly24h = new Date(startedAt.getTime() + MS_PER_DAY);
    expect(isUnlocked(exactly24h, startedAt, 1)).toBe(true);
  });

  it("unlocks day-5 only after 5 full days", () => {
    const after4d23h = new Date(startedAt.getTime() + 5 * MS_PER_DAY - 60_000);
    expect(isUnlocked(after4d23h, startedAt, 5)).toBe(false);

    const after5d = new Date(startedAt.getTime() + 5 * MS_PER_DAY);
    expect(isUnlocked(after5d, startedAt, 5)).toBe(true);
  });
});

describe("unlockInfo", () => {
  const startedAt = new Date("2026-01-01T00:00:00Z");

  it("reports daysUntilUnlock=0 once unlocked", () => {
    const after5d = new Date(startedAt.getTime() + 5 * MS_PER_DAY);
    const info = unlockInfo(after5d, startedAt, 3);
    expect(info.unlocked).toBe(true);
    expect(info.daysUntilUnlock).toBe(0);
  });

  it("ceilings the remaining days when not yet unlocked", () => {
    // 12 hours after enrollment, day-2 should still be 2 days away (ceiling
    // of 1.5).
    const after12h = new Date(startedAt.getTime() + 12 * 60 * 60 * 1000);
    const info = unlockInfo(after12h, startedAt, 2);
    expect(info.unlocked).toBe(false);
    expect(info.daysUntilUnlock).toBe(2);
  });

  it("returns the exact unlockAt timestamp", () => {
    const info = unlockInfo(startedAt, startedAt, 3);
    expect(info.unlockAt.toISOString()).toBe("2026-01-04T00:00:00.000Z");
  });
});
