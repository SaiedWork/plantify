import { CanActivate, ExecutionContext, HttpException, HttpStatus, Injectable, SetMetadata } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { RATE_LIMITS, type RateLimitBucket } from '@plantify/contracts';
import { sql } from 'drizzle-orm';
import type { Request, Response } from 'express';
import { InjectDb, type Db } from '../db/db.module.js';

const BUCKET = 'rate-limit:bucket';

/** Limits this route (or controller) per client IP using the limits of `bucket` in packages/contracts. */
export const RateLimit = (bucket: RateLimitBucket) => SetMetadata(BUCKET, bucket);

export type RateLimitResult = { allowed: boolean; retryAfterSeconds: number };

/**
 * Fixed-window counter in the shared `rate_limit` table (the same one Better Auth uses), so limits hold across
 * serverless instances. `last_request` stores the window start in epoch millis; keys are namespaced `plantify:`.
 */
@Injectable()
export class RateLimiter {
  constructor(@InjectDb() private readonly db: Db) {}

  async hit(key: string, max: number, windowSeconds: number, now = Date.now()): Promise<RateLimitResult> {
    const windowMs = windowSeconds * 1000;
    const { rows } = await this.db.execute<{ count: number; last_request: string }>(sql`
      insert into rate_limit (id, key, count, last_request)
      values (${crypto.randomUUID()}, ${`plantify:${key}`}, 1, ${now})
      on conflict (key) do update set
        count = case when rate_limit.last_request + ${windowMs} <= ${now} then 1 else rate_limit.count + 1 end,
        last_request = case when rate_limit.last_request + ${windowMs} <= ${now} then ${now} else rate_limit.last_request end
      returning count, last_request`);
    const { count, last_request } = rows[0]!;
    return {
      allowed: count <= max,
      retryAfterSeconds: Math.max(1, Math.ceil((Number(last_request) + windowMs - now) / 1000)),
    };
  }
}

/** Global guard: enforces @RateLimit(bucket) on a route. Routes without it are untouched. */
@Injectable()
export class RateLimitGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly limiter: RateLimiter,
  ) {}

  async canActivate(context: ExecutionContext) {
    const bucket = this.reflector.getAllAndOverride<RateLimitBucket | undefined>(BUCKET, [context.getHandler(), context.getClass()]);
    if (!bucket || process.env.APP_RATE_LIMIT === 'off') return true;

    const http = context.switchToHttp();
    const req = http.getRequest<Request>();
    const { max, windowSeconds } = RATE_LIMITS[bucket];
    const result = await this.limiter.hit(`${bucket}:${req.ip ?? 'unknown'}`, max, windowSeconds);
    if (result.allowed) return true;

    http.getResponse<Response>().setHeader('Retry-After', String(result.retryAfterSeconds));
    throw new HttpException('Too many requests, please slow down', HttpStatus.TOO_MANY_REQUESTS);
  }
}
