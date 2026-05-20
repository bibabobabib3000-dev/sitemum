/**
 * Drip unlock logic. A lesson is available when
 * `enrollment.started_at + day_offset days <= now`.
 *
 * The 5-day Immersion Week therefore unlocks one lesson per day starting
 * from the moment the user first opens the course (which is when we create
 * the enrollment row, see ensureEnrollment).
 */

const MS_PER_DAY = 24 * 60 * 60 * 1000;

export function isUnlocked(
  now: Date,
  startedAt: Date,
  dayOffset: number
): boolean {
  const unlockAt = new Date(startedAt.getTime() + dayOffset * MS_PER_DAY);
  return unlockAt.getTime() <= now.getTime();
}

export interface UnlockInfo {
  unlocked: boolean;
  unlockAt: Date;
  daysUntilUnlock: number;
}

export function unlockInfo(
  now: Date,
  startedAt: Date,
  dayOffset: number
): UnlockInfo {
  const unlockAt = new Date(startedAt.getTime() + dayOffset * MS_PER_DAY);
  const diffMs = unlockAt.getTime() - now.getTime();
  return {
    unlocked: diffMs <= 0,
    unlockAt,
    daysUntilUnlock: diffMs <= 0 ? 0 : Math.ceil(diffMs / MS_PER_DAY),
  };
}
