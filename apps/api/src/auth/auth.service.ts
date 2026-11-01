import { Injectable } from '@nestjs/common';
import { DAILY_NEW_USERS_CAP } from '@plantify/contracts';
import { account, rateLimit, session, user, verification } from '@plantify/db';
import { count, gt, sql } from 'drizzle-orm';
import { betterAuth } from 'better-auth';
import { drizzleAdapter } from 'better-auth/adapters/drizzle';
import { APIError, createAuthMiddleware } from 'better-auth/api';
import { emailOTP } from 'better-auth/plugins';
import { requireEnv } from '../env.js';
import { InjectDb, type Db } from '../db/db.module.js';
import {
  DEMO_INBOX_COOKIE,
  INBOX_COOKIE_OPTIONS,
  decodeInboxCookie,
  encodeInboxCookie,
  readCookie,
  withInboxGrant,
} from '../mail/demo-inbox-cookie.js';
import { MailService } from '../mail/mail.service.js';

// Requests that cause an email to be "sent"; the address gets added to this browser's demo-inbox cookie.
const MAIL_TRIGGER_PATHS = ['/sign-up/email', '/sign-in/email', '/email-otp/send-verification-otp', '/sign-in/email-otp'];

function createAuth(db: Db, mail: MailService) {
  const secret = requireEnv('BETTER_AUTH_SECRET');

  return betterAuth({
    baseURL: process.env.API_URL ?? 'http://localhost:4000',
    basePath: '/api/auth',
    secret,
    // Browsers talk to us through each Next app's /api rewrite, so these are the Origins we see.
    // In dev, plain localhost also works (the apps run on :3000 and :3001).
    trustedOrigins: [
      process.env.STOREFRONT_URL,
      process.env.ADMIN_URL,
      ...(process.env.NODE_ENV === 'production' ? [] : ['http://localhost:3000', 'http://localhost:3001']),
    ].filter((o): o is string => !!o),
    database: drizzleAdapter(db, {
      provider: 'pg',
      schema: { user, session, account, verification, rateLimit },
    }),
    emailAndPassword: { enabled: true, requireEmailVerification: true, minPasswordLength: 8 },
    emailVerification: { autoSignInAfterVerification: true },
    user: {
      additionalFields: {
        // input:false => clients can never set their own role; staff roles come from the seed only.
        role: { type: 'string', required: false, defaultValue: 'customer', input: false },
      },
    },
    // Switched off only by the e2e suite, which creates dozens of users from one IP.
    rateLimit: { enabled: process.env.AUTH_RATE_LIMIT !== 'off', storage: 'database', window: 60, max: 60 },
    databaseHooks: {
      user: {
        create: {
          before: async () => {
            const [row] = await db.select({ n: count() }).from(user).where(gt(user.createdAt, sql`now() - interval '24 hours'`));
            if ((row?.n ?? 0) >= DAILY_NEW_USERS_CAP) {
              throw new APIError('SERVICE_UNAVAILABLE', { message: 'The demo has reached its daily sign-up limit. Please try again tomorrow.' });
            }
          },
        },
      },
      session: {
        create: {
          // Signing in needs a verified email, so this is proof of owning the address: attach any guest orders placed with it.
          after: async (newSession) => {
            await db.execute(sql`
              update "order" o set user_id = u.id
              from "user" u
              where u.id = ${newSession.userId} and u.email_verified and o.user_id is null and lower(o.contact_email) = lower(u.email)`);
          },
        },
      },
    },
    plugins: [
      emailOTP({
        otpLength: 6,
        expiresIn: 600,
        allowedAttempts: 5,
        storeOTP: 'hashed',
        sendVerificationOnSignUp: true,
        overrideDefaultEmailVerification: true,
        rateLimit: { window: 60, max: 5 },
        async sendVerificationOTP({ email, otp, type }) {
          await mail.sendOtp(email, otp, type);
        },
      }),
    ],
    hooks: {
      after: createAuthMiddleware(async (ctx) => {
        const email = (ctx.body as { email?: unknown } | undefined)?.email;
        if (typeof email !== 'string' || !MAIL_TRIGGER_PATHS.includes(ctx.path)) return;
        const current = decodeInboxCookie(readCookie(ctx.headers?.get('cookie') ?? undefined, DEMO_INBOX_COOKIE), secret);
        ctx.setCookie(DEMO_INBOX_COOKIE, encodeInboxCookie(withInboxGrant(current, email), secret), INBOX_COOKIE_OPTIONS);
      }),
    },
  });
}

@Injectable()
export class AuthService {
  readonly auth: ReturnType<typeof createAuth>;

  constructor(@InjectDb() db: Db, mail: MailService) {
    this.auth = createAuth(db, mail);
  }
}
