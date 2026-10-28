import { Controller, Get, Param, Query } from '@nestjs/common';
import { productListQuerySchema, type ProductListQuery } from '@plantify/contracts';
import { Public } from '../auth/access.js';
import { ZodPipe } from '../common/zod-pipe.js';
import { CatalogService } from './catalog.service.js';

@Public()
@Controller()
export class CatalogController {
  constructor(private readonly catalog: CatalogService) {}

  @Get('categories')
  categories() {
    return this.catalog.categories();
  }

  @Get('products')
  products(@Query(new ZodPipe(productListQuerySchema)) query: ProductListQuery) {
    return this.catalog.list(query);
  }

  @Get('products/:slug')
  product(@Param('slug') slug: string) {
    return this.catalog.bySlug(slug);
  }
}
