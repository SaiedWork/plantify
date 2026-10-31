import { Body, Controller, Get, Param, Patch, Query, Req } from '@nestjs/common';
import {
  auditQuerySchema,
  dashboardQuerySchema,
  STAFF_ROLES,
  staffRolePatchSchema,
  type AuditQuery,
  type StaffMember,
} from '@plantify/contracts';
import { RequirePermission, Roles, type AuthedRequest } from '../auth/access.js';
import { ZodPipe } from '../common/zod-pipe.js';
import { AdminDashboardService } from './admin-dashboard.service.js';
import { AdminOverviewService } from './admin-overview.service.js';
import { AdminStaffService } from './admin-staff.service.js';

/** Owner-only areas: sales statistics, staff management and the audit trail. */
@Controller('admin')
export class AdminOwnerController {
  constructor(
    private readonly dashboard: AdminDashboardService,
    private readonly overviewStats: AdminOverviewService,
    private readonly staff: AdminStaffService,
  ) {}

  @Roles(...STAFF_ROLES)
  @Get('overview')
  overview(@Req() req: AuthedRequest, @Query(new ZodPipe(dashboardQuerySchema)) query: { days: number }) {
    return this.overviewStats.overview(req.user!.role, query.days);
  }

  @RequirePermission('dashboard:revenue')
  @Get('dashboard')
  stats(@Query(new ZodPipe(dashboardQuerySchema)) query: { days: number }) {
    return this.dashboard.stats(query.days);
  }

  @RequirePermission('staff:manage')
  @Get('staff')
  listStaff() {
    return this.staff.list();
  }

  @RequirePermission('staff:manage')
  @Patch('staff/:id')
  changeRole(@Req() req: AuthedRequest, @Param('id') id: string, @Body(new ZodPipe(staffRolePatchSchema)) body: { role: StaffMember['role'] }) {
    return this.staff.changeRole(req.user!.id, id, body.role);
  }

  @RequirePermission('staff:manage')
  @Get('audit')
  audit(@Query(new ZodPipe(auditQuerySchema)) query: AuditQuery) {
    return this.staff.auditLog(query);
  }
}
