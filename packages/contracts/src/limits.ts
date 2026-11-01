/** Abuse and cost protection for the public demo. Rolling 24h caps are checked in the API. */
export const DAILY_NEW_USERS_CAP = 200;
export const DAILY_NEW_ORDERS_CAP = 300;

/** Fixed-window request limits per client IP (see apps/api RateLimit). */
export const RATE_LIMITS = {
  cart: { max: 120, windowSeconds: 60 },
  checkout: { max: 20, windowSeconds: 60 },
  payment: { max: 10, windowSeconds: 60 },
  lookup: { max: 10, windowSeconds: 60 },
} as const;
export type RateLimitBucket = keyof typeof RATE_LIMITS;
