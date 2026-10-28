import { Body, Controller, Delete, Get, HttpCode, Param, Patch, Post, Req } from '@nestjs/common';
import {
  savedAddressPatchSchema,
  savedAddressSchema,
  type SavedAddressInput,
} from '@plantify/contracts';
import type { AuthedRequest } from '../auth/access.js';
import { ZodPipe } from '../common/zod-pipe.js';
import { AddressesService } from './addresses.service.js';

@Controller('addresses')
export class AddressesController {
  constructor(private readonly addresses: AddressesService) {}

  @Get()
  list(@Req() req: AuthedRequest) {
    return this.addresses.list(req.user!.id);
  }

  @Post()
  create(@Req() req: AuthedRequest, @Body(new ZodPipe(savedAddressSchema)) body: SavedAddressInput) {
    return this.addresses.create(req.user!.id, body);
  }

  @Patch(':id')
  update(
    @Req() req: AuthedRequest,
    @Param('id') id: string,
    @Body(new ZodPipe(savedAddressPatchSchema)) body: Partial<SavedAddressInput>,
  ) {
    return this.addresses.update(req.user!.id, id, body);
  }

  @Delete(':id')
  @HttpCode(204)
  async remove(@Req() req: AuthedRequest, @Param('id') id: string) {
    await this.addresses.remove(req.user!.id, id);
  }
}
