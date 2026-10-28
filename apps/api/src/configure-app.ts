import type { NestExpressApplication } from '@nestjs/platform-express';
import { toNodeHandler } from 'better-auth/node';
import type { IncomingMessage } from 'node:http';
import { AuthService } from './auth/auth.service.js';

/** Create the app with `{ bodyParser: false }`: Better Auth must see the raw body, so JSON parsing is added after its route. */
export function configureApp(app: NestExpressApplication) {
  app.setGlobalPrefix('api');

  const { auth } = app.get(AuthService);
  app.getHttpAdapter().getInstance().all('/api/auth/*splat', toNodeHandler(auth));

  // rawBody is kept for HMAC verification of inbound webhooks.
  app.useBodyParser('json', {
    verify: (req: IncomingMessage & { rawBody?: Buffer }, _res: unknown, buf: Buffer) => {
      req.rawBody = buf;
    },
  } as never);
}
