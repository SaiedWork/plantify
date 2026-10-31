import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import type { AuditEntry, AuditQuery, Page, Role, StaffMember } from '@plantify/contracts';
import { sql, type SQL } from 'drizzle-orm';
import { AuditService } from '../audit/audit.service.js';
import { offsetOf } from '../common/db-errors.js';
import { InjectDb, type Db } from '../db/db.module.js';

type StaffRole = StaffMember['role'];
type UserRow = { id: string; name: string; email: string; role: Role; email_verified: boolean; created_at: Date };

const toMember = (r: UserRow): StaffMember => ({
  id: r.id,
  name: r.name,
  email: r.email,
  role: r.role as StaffRole,
  createdAt: new Date(r.created_at).toISOString(),
});

@Injectable()
export class AdminStaffService {
  constructor(
    @InjectDb() private readonly db: Db,
    private readonly audit: AuditService,
  ) {}

  async list(): Promise<StaffMember[]> {
    const { rows } = await this.db.execute<UserRow>(sql`
      select id, name, email, role, email_verified, created_at from "user"
      where role <> 'customer' order by (role = 'owner') desc, name`);
    return rows.map(toMember);
  }

  /**
   * Gives a non-owner staff member the other switchable role. Each role has exactly one holder, so whoever
   * held the requested role is moved to this person's previous one. The owner is fixed.
   */
  async changeRole(actorId: string, id: string, role: StaffRole): Promise<StaffMember> {
    const user = await this.staffMember(id);
    if (user.role === 'owner') throw new ConflictException('The owner role cannot be changed');
    if (user.role === role) return toMember(user);

    await this.db.transaction(async (tx) => {
      const { rows } = await tx.execute<{ id: string; email: string }>(
        sql`select id, email from "user" where role = ${role} and id <> ${id} for update`,
      );
      const other = rows[0];
      if (other) {
        await tx.execute(sql`update "user" set role = ${user.role}, updated_at = now() where id = ${other.id}`);
        await this.audit.log(actorId, 'staff.role', other.id, { email: other.email, from: role, to: user.role }, tx);
      }
      await tx.execute(sql`update "user" set role = ${role}, updated_at = now() where id = ${id}`);
      await this.audit.log(actorId, 'staff.role', id, { email: user.email, from: user.role, to: role }, tx);
    });
    return toMember({ ...user, role });
  }

  private async staffMember(id: string): Promise<UserRow> {
    const { rows } = await this.db.execute<UserRow>(sql`
      select id, name, email, role, email_verified, created_at from "user"
      where id = ${id} and role <> 'customer'`);
    if (!rows[0]) throw new NotFoundException('Staff member not found');
    return rows[0];
  }

  // ---- audit log -------------------------------------------------------------------------------

  async auditLog(query: AuditQuery): Promise<Page<AuditEntry>> {
    const where: SQL[] = [sql`true`];
    if (query.action) where.push(sql`a.action like ${query.action.replace(/[%_\\]/g, '\\$&') + '%'}`);
    if (query.actorId) where.push(sql`a.actor_id = ${query.actorId}`);

    const { rows } = await this.db.execute<{
      id: string;
      action: string;
      target: string | null;
      detail: unknown;
      created_at: Date;
      actor_id: string | null;
      actor_name: string | null;
      actor_email: string | null;
      total: string;
    }>(sql`
      select a.id, a.action, a.target, a.detail, a.created_at, u.id as actor_id, u.name as actor_name, u.email as actor_email,
             count(*) over() as total
      from audit_log a left join "user" u on u.id = a.actor_id
      where ${sql.join(where, sql` and `)}
      order by a.created_at desc limit ${query.pageSize} offset ${offsetOf(query.page, query.pageSize)}`);

    return {
      items: rows.map((r) => ({
        id: r.id,
        action: r.action,
        target: r.target,
        detail: r.detail,
        createdAt: new Date(r.created_at).toISOString(),
        actor: r.actor_id ? { id: r.actor_id, name: r.actor_name!, email: r.actor_email! } : null,
      })),
      total: rows[0] ? Number(rows[0].total) : 0,
      page: query.page,
      pageSize: query.pageSize,
    };
  }
}
