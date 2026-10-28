import { Module } from '@nestjs/common';
import { DemoInboxController } from './demo-inbox.controller.js';
import { MailService } from './mail.service.js';

@Module({
  controllers: [DemoInboxController],
  providers: [MailService],
  exports: [MailService],
})
export class MailModule {}
