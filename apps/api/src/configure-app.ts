import type { NestExpressApplication } from '@nestjs/platform-express';
import { toNodeHandler } from 'better-auth/node';
import type { IncomingMessage } from 'node:http';
import { UPLOAD_DIR, UPLOAD_URL_PREFIX } from './admin/storage.js';
import { AuthService } from './auth/auth.service.js';

/** Create the app with `{ bodyParser: false }`: Better Auth must see the raw body, so JSON parsing is added after its route. */
export function configureApp(app: NestExpressApplication) {
  app.setGlobalPrefix('api');

  const { auth } = app.get(AuthService);
  app.getHttpAdapter().getInstance().all('/api/auth/*splat', toNodeHandler(auth));

  // Dev-only upload storage; in production files live in Vercel Blob and these URLs are absolute.
  app.useStaticAssets(UPLOAD_DIR, { prefix: UPLOAD_URL_PREFIX });

  // rawBody is kept for HMAC verification of inbound webhooks.
  app.useBodyParser('json', {
    verify: (req: IncomingMessage & { rawBody?: Buffer }, _res: unknown, buf: Buffer) => {
      req.rawBody = buf;
    },
  } as never);
}
