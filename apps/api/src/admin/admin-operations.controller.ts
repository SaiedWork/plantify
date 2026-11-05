import { Body, Controller, Get, HttpCode, Param, Post, Query, Req } from '@nestjs/common';
import {
  adjustStockSchema,
  adminOrderQuerySchema,
  customerQuerySchema,
  inventoryQuerySchema,
  orderStatusChangeSchema,
  refundSchema,
  type AdjustStockInput,
  type AdminOrderQuery,
  type CustomerQuery,
  type InventoryQuery,
} from '@plantify/contracts';
import { RequirePermission, type AuthedRequest } from '../auth/access.js';
import { ZodPipe } from '../common/zod-pipe.js';
import { AdminCustomersService } from './admin-customers.service.js';
import { AdminInventoryService } from './admin-inventory.service.js';
import { AdminOrdersService } from './admin-orders.service.js';

@Controller('admin')
export class AdminOperationsController {
  constructor(
    private readonly inventory: AdminInventoryService,
    private readonly orders: AdminOrdersService,
    private readonly customers: AdminCustomersService,
  ) {}

  @RequirePermission('inventory:manage')
  @Get('inventory')
  listInventory(@Query(new ZodPipe(inventoryQuerySchema)) query: InventoryQuery) {
    return this.inventory.list(query);
  }

  @RequirePermission('inventory:manage')
  @Post('inventory/:variantId/adjust')
  @HttpCode(200)
  adjust(@Req() req: AuthedRequest, @Param('variantId') variantId: string, @Body(new ZodPipe(adjustStockSchema)) body: AdjustStockInput) {
    return this.inventory.adjust(req.user!.id, variantId, body);
  }

  @RequirePermission('inventory:manage')
  @Get('inventory/:variantId/movements')
  movements(@Param('variantId') variantId: string) {
    return this.inventory.movements(variantId);
  }

  @RequirePermission('orders:view')
  @Get('orders')
  listOrders(@Query(new ZodPipe(adminOrderQuerySchema)) query: AdminOrderQuery) {
    return this.orders.list(query);
  }

  @RequirePermission('orders:view')
  @Get('orders/:id')
  getOrder(@Param('id') id: string) {
    return this.orders.get(id);
  }

  @RequirePermission('orders:fulfil')
  @Post('orders/:id/status')
  @HttpCode(200)
  changeStatus(@Req() req: AuthedRequest, @Param('id') id: string, @Body(new ZodPipe(orderStatusChangeSchema)) body: { status: 'processing' | 'shipped' | 'delivered' | 'cancelled' }) {
    return this.orders.changeStatus(req.user!.id, id, body.status);
  }

  @RequirePermission('orders:refund')
  @Post('orders/:id/refund')
  @HttpCode(200)
  refund(@Req() req: AuthedRequest, @Param('id') id: string, @Body(new ZodPipe(refundSchema)) body: { restock: boolean; reason?: string }) {
    return this.orders.refund(req.user!.id, id, body);
  }

  @RequirePermission('customers:view')
  @Get('customers')
  listCustomers(@Query(new ZodPipe(customerQuerySchema)) query: CustomerQuery) {
    return this.customers.list(query);
  }

  @RequirePermission('customers:view')
  @Get('customers/:id')
  getCustomer(@Param('id') id: string) {
    return this.customers.get(id);
  }
}
