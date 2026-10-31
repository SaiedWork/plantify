/** The demo database is wiped and reseeded once it is this old. */
export const RESET_INTERVAL_DAYS = 7;
const DAY_MS = 24 * 60 * 60 * 1000;

export type DemoStatus = {
  lastResetAt: string | null;
  nextResetAt: string | null;
  /** Whole days left, rounded up; 0 means the next daily cron run resets the data. */
  daysUntilReset: number | null;
};

export function isResetDue(lastResetAt: Date | null, now = new Date()) {
  return !lastResetAt || now.getTime() - lastResetAt.getTime() >= RESET_INTERVAL_DAYS * DAY_MS;
}

export function demoStatus(lastResetAt: Date | null, now = new Date()): DemoStatus {
  if (!lastResetAt) return { lastResetAt: null, nextResetAt: null, daysUntilReset: null };
  const next = new Date(lastResetAt.getTime() + RESET_INTERVAL_DAYS * DAY_MS);
  return {
    lastResetAt: lastResetAt.toISOString(),
    nextResetAt: next.toISOString(),
    daysUntilReset: Math.max(0, Math.ceil((next.getTime() - now.getTime()) / DAY_MS)),
  };
}
