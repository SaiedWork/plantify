import {
  BadRequestException,
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  Param,
  Patch,
  Post,
  Query,
  Req,
  UploadedFile,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import {
  addImageSchema,
  adminProductQuerySchema,
  categoryInputSchema,
  categoryPatchSchema,
  createProductSchema,
  newVariantSchema,
  productPatchSchema,
  variantPatchSchema,
  type AdminProductQuery,
  type CreateProductInput,
  type NewVariantInput,
} from '@plantify/contracts';
import { RequirePermission, type AuthedRequest } from '../auth/access.js';
import { ZodPipe } from '../common/zod-pipe.js';
import { AdminCategoriesService } from './admin-categories.service.js';
import { AdminProductsService } from './admin-products.service.js';
import { createStorage, sniffImage, type StorageProvider } from './storage.js';

const MAX_UPLOAD_BYTES = 1024 * 1024;

@RequirePermission('catalog:manage')
@Controller('admin')
export class AdminCatalogController {
  private readonly storage: StorageProvider = createStorage();

  constructor(
    private readonly products: AdminProductsService,
    private readonly categories: AdminCategoriesService,
  ) {}

  // ---- products --------------------------------------------------------------------------------

  @Get('products')
  list(@Query(new ZodPipe(adminProductQuerySchema)) query: AdminProductQuery) {
    return this.products.list(query);
  }

  @Get('products/:id')
  get(@Param('id') id: string) {
    return this.products.get(id);
  }

  @Post('products')
  create(@Req() req: AuthedRequest, @Body(new ZodPipe(createProductSchema)) body: CreateProductInput) {
    return this.products.create(req.user!.id, body);
  }

  @Patch('products/:id')
  update(@Req() req: AuthedRequest, @Param('id') id: string, @Body(new ZodPipe(productPatchSchema)) body: Parameters<AdminProductsService['update']>[2]) {
    return this.products.update(req.user!.id, id, body);
  }

  @Delete('products/:id')
  @HttpCode(204)
  async remove(@Req() req: AuthedRequest, @Param('id') id: string) {
    await this.products.remove(req.user!.id, id);
  }

  // ---- variants --------------------------------------------------------------------------------

  @Post('products/:id/variants')
  addVariant(@Req() req: AuthedRequest, @Param('id') id: string, @Body(new ZodPipe(newVariantSchema)) body: NewVariantInput) {
    return this.products.addVariant(req.user!.id, id, body);
  }

  @Patch('variants/:id')
  patchVariant(@Req() req: AuthedRequest, @Param('id') id: string, @Body(new ZodPipe(variantPatchSchema)) body: Parameters<AdminProductsService['patchVariant']>[2]) {
    return this.products.patchVariant(req.user!.id, id, body);
  }

  @Delete('variants/:id')
  removeVariant(@Req() req: AuthedRequest, @Param('id') id: string) {
    return this.products.removeVariant(req.user!.id, id);
  }

  // ---- images ----------------------------------------------------------------------------------

  @Post('products/:id/images')
  addImage(@Req() req: AuthedRequest, @Param('id') id: string, @Body(new ZodPipe(addImageSchema)) body: { url: string; alt: string }) {
    return this.products.addImage(req.user!.id, id, body.url, body.alt);
  }

  @Delete('images/:id')
  removeImage(@Req() req: AuthedRequest, @Param('id') id: string) {
    return this.products.removeImage(req.user!.id, id);
  }

  @Post('images/:id/primary')
  @HttpCode(200)
  makePrimary(@Req() req: AuthedRequest, @Param('id') id: string) {
    return this.products.makePrimaryImage(req.user!.id, id);
  }

  @Post('uploads')
  @UseInterceptors(FileInterceptor('file', { limits: { fileSize: MAX_UPLOAD_BYTES, files: 1 } }))
  async upload(@UploadedFile() file?: { buffer: Buffer }) {
    if (!file) throw new BadRequestException('Choose an image to upload');
    const kind = sniffImage(file.buffer);
    if (!kind) throw new BadRequestException('Only JPEG, PNG or WebP images are allowed');
    const url = await this.storage.save(`${crypto.randomUUID()}.${kind.ext}`, file.buffer, kind.type);
    return { url };
  }

  // ---- categories ------------------------------------------------------------------------------

  @Get('categories')
  listCategories() {
    return this.categories.list();
  }

  @Post('categories')
  createCategory(@Req() req: AuthedRequest, @Body(new ZodPipe(categoryInputSchema)) body: { name: string; description?: string; sortOrder?: number }) {
    return this.categories.create(req.user!.id, body);
  }

  @Patch('categories/:id')
  updateCategory(@Req() req: AuthedRequest, @Param('id') id: string, @Body(new ZodPipe(categoryPatchSchema)) body: { name?: string; description?: string; sortOrder?: number }) {
    return this.categories.update(req.user!.id, id, body);
  }

  @Delete('categories/:id')
  @HttpCode(204)
  async removeCategory(@Req() req: AuthedRequest, @Param('id') id: string) {
    await this.categories.remove(req.user!.id, id);
  }
}
