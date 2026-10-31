import { Controller, Get, Headers, HttpCode, Post, Query, UnauthorizedException } from '@nestjs/common';
import { timingSafeEqual } from 'node:crypto';
import { Public } from '../auth/access.js';
import { requireEnv } from '../env.js';
import { ResetService } from './reset.service.js';

function validSecret(header: string | undefined) {
  const given = Buffer.from(header?.replace(/^Bearer /i, '') ?? '');
  const expected = Buffer.from(requireEnv('CRON_SECRET'));
  return given.length === expected.length && timingSafeEqual(given, expected);
}

@Public()
@Controller()
export class InternalController {
  constructor(private readonly reset: ResetService) {}

  /** Public: feeds the "resets in N days" banner. */
  @Get('demo/status')
  status() {
    return this.reset.status();
  }

  /** Vercel Cron only issues GET, sending `Authorization: Bearer $CRON_SECRET`. Resets only once the data is 7 days old. */
  @Get('internal/reset')
  cron(@Headers('authorization') authorization: string | undefined) {
    return this.run(authorization, false);
  }

  /** Manual trigger (GitHub Actions workflow_dispatch); `?force=1` skips the age check. */
  @Post('internal/reset')
  @HttpCode(200)
  manual(@Headers('authorization') authorization: string | undefined, @Query('force') force?: string) {
    return this.run(authorization, force === '1' || force === 'true');
  }

  private run(authorization: string | undefined, force: boolean) {
    if (!validSecret(authorization)) throw new UnauthorizedException();
    return this.reset.resetIfDue({ force });
  }
}
