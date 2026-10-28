import { Global, Injectable, Module } from '@nestjs/common';
import { sql } from 'drizzle-orm';
import { InjectDb, type Db } from '../db/db.module.js';

type Executor = Pick<Db, 'execute'>;

/** Append-only record of staff actions (shown to owners in the admin app). */
@Injectable()
export class AuditService {
  constructor(@InjectDb() private readonly db: Db) {}

  /** Pass a transaction as `executor` to make the entry atomic with the change it describes. */
  async log(actorId: string, action: string, target: string | null, detail?: Record<string, unknown>, executor: Executor = this.db) {
    await executor.execute(sql`
      insert into audit_log (id, actor_id, action, target, detail)
      values (${crypto.randomUUID()}, ${actorId}, ${action}, ${target}, ${detail ? JSON.stringify(detail) : null}::jsonb)`);
  }
}

@Global()
@Module({ providers: [AuditService], exports: [AuditService] })
export class AuditModule {}
