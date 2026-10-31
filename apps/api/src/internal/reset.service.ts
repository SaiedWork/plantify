import { Injectable, Logger } from '@nestjs/common';
import { demoStatus, isResetDue, type DemoStatus } from '@plantify/contracts';
import { getLastResetAt, resetDatabase } from '@plantify/db';
import { createStorage, type StorageProvider } from '../admin/storage.js';
import { InjectDb, type Db } from '../db/db.module.js';

export type ResetOutcome =
  | { reset: false; reason: 'not_due'; status: DemoStatus }
  | { reset: true; seeded: Awaited<ReturnType<typeof resetDatabase>>; uploadsRemoved: number; status: DemoStatus };

@Injectable()
export class ResetService {
  private readonly logger = new Logger(ResetService.name);
  private readonly storage: StorageProvider = createStorage();

  constructor(@InjectDb() private readonly db: Db) {}

  async status(now = new Date()): Promise<DemoStatus> {
    return demoStatus(await getLastResetAt(this.db), now);
  }

  /** Wipes and reseeds when the data is at least RESET_INTERVAL_DAYS old (or `force`), then clears uploaded files. */
  async resetIfDue({ force = false, now = new Date() } = {}): Promise<ResetOutcome> {
    const seeded = await resetDatabase(this.db, { now, onlyIf: (last) => force || isResetDue(last, now) });
    if (!seeded) return { reset: false, reason: 'not_due', status: await this.status(now) };

    // Rows referencing the files are already gone; a storage failure must not undo a finished reset.
    const uploadsRemoved = await this.storage.deleteAll().catch((err: unknown) => {
      this.logger.error(`Upload cleanup failed: ${err instanceof Error ? err.message : String(err)}`);
      return 0;
    });
    this.logger.log(`Demo data reset (${uploadsRemoved} uploads removed)`);
    return { reset: true, seeded, uploadsRemoved, status: await this.status(now) };
  }
}
