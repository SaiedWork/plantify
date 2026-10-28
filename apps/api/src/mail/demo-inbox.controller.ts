import { Controller, Get, Req } from '@nestjs/common';
import { demoEmail } from '@plantify/db';
import { desc, inArray } from 'drizzle-orm';
import type { Request } from 'express';
import { Public } from '../auth/access.js';
import { InjectDb, type Db } from '../db/db.module.js';
import { requireEnv } from '../env.js';
import { DEMO_INBOX_COOKIE, decodeInboxCookie, readCookie } from './demo-inbox-cookie.js';

@Controller('demo-inbox')
export class DemoInboxController {
  constructor(@InjectDb() private readonly db: Db) {}

  /** Messages for the addresses this browser triggered mail for (signed cookie). */
  @Public()
  @Get()
  async list(@Req() req: Request) {
    const emails = decodeInboxCookie(readCookie(req.headers.cookie, DEMO_INBOX_COOKIE), requireEnv('BETTER_AUTH_SECRET'));
    if (emails.length === 0) return { emails: [], messages: [] };
    const messages = await this.db
      .select()
      .from(demoEmail)
      .where(inArray(demoEmail.to, emails))
      .orderBy(desc(demoEmail.createdAt))
      .limit(50);
    return { emails, messages };
  }
}
