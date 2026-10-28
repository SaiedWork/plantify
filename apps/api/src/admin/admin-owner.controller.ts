import { Body, Controller, Delete, Get, HttpCode, Param, Patch, Post, Query, Req } from '@nestjs/common';
import {
  auditQuerySchema,
  dashboardQuerySchema,
  grantStaffSchema,
  staffRolePatchSchema,
  type AuditQuery,
  type StaffMember,
} from '@plantify/contracts';
import { RequirePermission, type AuthedRequest } from '../auth/access.js';
import { ZodPipe } from '../common/zod-pipe.js';
import { AdminDashboardService } from './admin-dashboard.service.js';
import { AdminStaffService } from './admin-staff.service.js';

/** Owner-only areas: sales statistics, staff management and the audit trail. */
@Controller('admin')
export class AdminOwnerController {
  constructor(
    private readonly dashboard: AdminDashboardService,
    private readonly staff: AdminStaffService,
  ) {}

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
  @Post('staff')
  grant(@Req() req: AuthedRequest, @Body(new ZodPipe(grantStaffSchema)) body: { email: string; role: StaffMember['role'] }) {
    return this.staff.grant(req.user!.id, body.email, body.role);
  }

  @RequirePermission('staff:manage')
  @Patch('staff/:id')
  changeRole(@Req() req: AuthedRequest, @Param('id') id: string, @Body(new ZodPipe(staffRolePatchSchema)) body: { role: StaffMember['role'] }) {
    return this.staff.changeRole(req.user!.id, id, body.role);
  }

  @RequirePermission('staff:manage')
  @Delete('staff/:id')
  @HttpCode(204)
  async revoke(@Req() req: AuthedRequest, @Param('id') id: string) {
    await this.staff.revoke(req.user!.id, id);
  }

  @RequirePermission('staff:manage')
  @Get('audit')
  audit(@Query(new ZodPipe(auditQuerySchema)) query: AuditQuery) {
    return this.staff.auditLog(query);
  }
}
