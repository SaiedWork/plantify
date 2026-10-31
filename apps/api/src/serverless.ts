import './env.js';
import { NestFactory } from '@nestjs/core';
import type { NestExpressApplication } from '@nestjs/platform-express';
import type { IncomingMessage, ServerResponse } from 'node:http';
import { AppModule } from './app.module.js';
import { configureApp } from './configure-app.js';

type Handler = (req: IncomingMessage, res: ServerResponse) => void;

let cached: Promise<Handler> | undefined;

/** Vercel entry: the Nest app is built once per warm instance and reused for every request. */
async function createHandler(): Promise<Handler> {
  const app = await NestFactory.create<NestExpressApplication>(AppModule, { bodyParser: false });
  configureApp(app);
  await app.init();
  return app.getHttpAdapter().getInstance() as Handler;
}

export default async function handler(req: IncomingMessage, res: ServerResponse) {
  cached ??= createHandler().catch((err: unknown) => {
    cached = undefined; // do not cache a failed boot
    throw err;
  });
  (await cached)(req, res);
}
