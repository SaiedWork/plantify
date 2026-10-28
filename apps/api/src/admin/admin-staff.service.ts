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
      where role in ('owner', 'catalog_manager') order by (role = 'owner') desc, name`);
    return rows.map(toMember);
  }

  /** Promotes an existing, verified account. Staff are never created from scratch here. */
  async grant(actorId: string, email: string, role: StaffRole): Promise<StaffMember> {
    const { rows } = await this.db.execute<UserRow>(
      sql`select id, name, email, role, email_verified, created_at from "user" where email = ${email}`,
    );
    const user = rows[0];
    if (!user) throw new NotFoundException('No account uses that email. They need to sign up in the store first.');
    if (!user.email_verified) throw new ConflictException('That account has not verified its email yet');
    if (user.role !== 'customer') throw new ConflictException('That person already has staff access');

    await this.db.execute(sql`update "user" set role = ${role}, updated_at = now() where id = ${user.id}`);
    await this.audit.log(actorId, 'staff.grant', user.id, { email, role });
    return toMember({ ...user, role });
  }

  async changeRole(actorId: string, id: string, role: StaffRole): Promise<StaffMember> {
    const user = await this.staffMember(id);
    if (user.id === actorId) throw new ConflictException('You cannot change your own role');
    if (user.role === role) return toMember(user);
    await this.guardLastOwner(user);
    await this.db.execute(sql`update "user" set role = ${role}, updated_at = now() where id = ${id}`);
    await this.audit.log(actorId, 'staff.role', id, { email: user.email, from: user.role, to: role });
    return toMember({ ...user, role });
  }

  async revoke(actorId: string, id: string): Promise<void> {
    const user = await this.staffMember(id);
    if (user.id === actorId) throw new ConflictException('You cannot remove your own access');
    await this.guardLastOwner(user);
    await this.db.transaction(async (tx) => {
      await tx.execute(sql`update "user" set role = 'customer', updated_at = now() where id = ${id}`);
      // Drop their sessions so the change takes effect immediately.
      await tx.execute(sql`delete from session where user_id = ${id}`);
      await this.audit.log(actorId, 'staff.revoke', id, { email: user.email, was: user.role }, tx);
    });
  }

  private async staffMember(id: string): Promise<UserRow> {
    const { rows } = await this.db.execute<UserRow>(sql`
      select id, name, email, role, email_verified, created_at from "user"
      where id = ${id} and role in ('owner', 'catalog_manager')`);
    if (!rows[0]) throw new NotFoundException('Staff member not found');
    return rows[0];
  }

  private async guardLastOwner(user: UserRow) {
    if (user.role !== 'owner') return;
    const { rows } = await this.db.execute<{ n: string }>(sql`select count(*) as n from "user" where role = 'owner'`);
    if (Number(rows[0]!.n) <= 1) throw new ConflictException('There must always be at least one owner');
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
