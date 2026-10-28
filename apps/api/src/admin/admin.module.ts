import { Module } from '@nestjs/common';
import { AdminCategoriesService } from './admin-categories.service.js';
import { AdminCatalogController } from './admin-catalog.controller.js';
import { AdminCustomersService } from './admin-customers.service.js';
import { AdminInventoryService } from './admin-inventory.service.js';
import { AdminOperationsController } from './admin-operations.controller.js';
import { AdminOrdersService } from './admin-orders.service.js';
import { AdminProductsService } from './admin-products.service.js';

@Module({
  controllers: [AdminCatalogController, AdminOperationsController],
  providers: [AdminProductsService, AdminCategoriesService, AdminInventoryService, AdminOrdersService, AdminCustomersService],
})
export class AdminModule {}
