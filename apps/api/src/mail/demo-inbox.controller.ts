import { Controller, Get, Req } from '@nestjs/common';
import { demoEmail } from '@plantify/db';
import { and, desc, eq, gte, or } from 'drizzle-orm';
import { OptionalAuth, type AuthedRequest } from '../auth/access.js';
import { InjectDb, type Db } from '../db/db.module.js';
import { requireEnv } from '../env.js';
import { DEMO_INBOX_COOKIE, decodeInboxCookie, readCookie } from './demo-inbox-cookie.js';

@Controller('demo-inbox')
export class DemoInboxController {
  constructor(@InjectDb() private readonly db: Db) {}

  /**
   * Messages for the addresses this browser triggered mail for (signed cookie, only from when it asked), plus
   * everything sent to the signed-in user's own address.
   */
  @OptionalAuth()
  @Get()
  async list(@Req() req: AuthedRequest) {
    const cookie = decodeInboxCookie(readCookie(req.headers.cookie, DEMO_INBOX_COOKIE), requireEnv('BETTER_AUTH_SECRET'));
    const own = req.user?.email.toLowerCase();
    const grants = own ? [...cookie.filter((g) => g.email !== own), { email: own, since: 0 }] : cookie;
    if (grants.length === 0) return { emails: [], messages: [] };
    const messages = await this.db
      .select()
      .from(demoEmail)
      .where(or(...grants.map((g) => and(eq(demoEmail.to, g.email), gte(demoEmail.createdAt, new Date(g.since))))))
      .orderBy(desc(demoEmail.createdAt))
      .limit(50);
    return { emails: grants.map((g) => g.email), messages };
  }
}
