import { Module } from '@nestjs/common';
import { AdminCategoriesService } from './admin-categories.service.js';
import { AdminCatalogController } from './admin-catalog.controller.js';
import { AdminDashboardService } from './admin-dashboard.service.js';
import { AdminCustomersService } from './admin-customers.service.js';
import { AdminInventoryService } from './admin-inventory.service.js';
import { AdminOperationsController } from './admin-operations.controller.js';
import { AdminOverviewService } from './admin-overview.service.js';
import { AdminOwnerController } from './admin-owner.controller.js';
import { AdminOrdersService } from './admin-orders.service.js';
import { AdminProductsService } from './admin-products.service.js';
import { AdminStaffService } from './admin-staff.service.js';

@Module({
  controllers: [AdminCatalogController, AdminOperationsController, AdminOwnerController],
  providers: [AdminProductsService, AdminCategoriesService, AdminInventoryService, AdminOrdersService, AdminCustomersService, AdminDashboardService, AdminOverviewService, AdminStaffService],
})
export class AdminModule {}
