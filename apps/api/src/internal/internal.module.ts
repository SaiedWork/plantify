import { Module } from '@nestjs/common';
import { InternalController } from './internal.controller.js';
import { ResetService } from './reset.service.js';

@Module({ controllers: [InternalController], providers: [ResetService] })
export class InternalModule {}
