import { Controller, Get } from '@nestjs/common';
import { Public } from './auth/access.js';

@Controller('health')
export class HealthController {
  @Public()
  @Get()
  check() {
    return { status: 'ok', service: 'plantify-api' };
  }
}
