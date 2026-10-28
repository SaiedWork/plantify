import { Global, Inject, Injectable, Module, type OnApplicationShutdown } from '@nestjs/common';
import { createDb, type Db } from '@plantify/db';

export const DB = Symbol('DB');
export const InjectDb = () => Inject(DB);
export type { Db };

@Injectable()
class DbLifecycle implements OnApplicationShutdown {
  constructor(@Inject('DB_CLOSE') private readonly close: () => Promise<void>) {}
  onApplicationShutdown() {
    return this.close();
  }
}

@Global()
@Module({
  providers: [
    { provide: 'DB_HANDLE', useFactory: () => createDb() },
    { provide: DB, inject: ['DB_HANDLE'], useFactory: (h: ReturnType<typeof createDb>) => h.db },
    { provide: 'DB_CLOSE', inject: ['DB_HANDLE'], useFactory: (h: ReturnType<typeof createDb>) => h.close },
    DbLifecycle,
  ],
  exports: [DB],
})
export class DbModule {}
