import { Module } from '@nestjs/common';
import { SupportMailService } from './support-mail.service';
import { SupportMailController } from './support-mail.controller';
import { RelationalSupportMailPersistenceModule } from './infrastructure/persistence/relational/relational-persistence.module';
import { ClientModule } from '../client/client.module';
import { SupportModule } from '../support/support.module';
import { MailerModule } from '../mailer/mailer.module';

@Module({
  imports: [
    RelationalSupportMailPersistenceModule,
    ClientModule,
    SupportModule,
    MailerModule,
  ],
  controllers: [SupportMailController],
  providers: [SupportMailService],
  exports: [SupportMailService, RelationalSupportMailPersistenceModule],
})
export class SupportMailModule {}

