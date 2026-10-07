import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { MailService } from './mail.service';
import { MailerModule } from '../mailer/mailer.module';
import { MailTemplatePreviewController } from './mail-template-preview.controller';
import { MailTemplatePreviewService } from './mail-template-preview.service';
import { SessionModule } from '../session/session.module';

@Module({
  imports: [ConfigModule, MailerModule, SessionModule],
  controllers: [MailTemplatePreviewController],
  providers: [MailService, MailTemplatePreviewService],
  exports: [MailService],
})
export class MailModule {}
