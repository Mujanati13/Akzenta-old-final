import { Module } from '@nestjs/common';
import { NotificationsController } from './notifications.controller';
import { NotificationsService } from './notifications.service';
import { RelationalNotificationPersistenceModule } from './infrastructure/persistence/relational/relational-persistence.module';
import { SessionModule } from '../session/session.module';

const infrastructurePersistenceModule = RelationalNotificationPersistenceModule;

@Module({
  imports: [
    infrastructurePersistenceModule,
    SessionModule
  ],
  controllers: [NotificationsController],
  providers: [NotificationsService],
  exports: [NotificationsService, infrastructurePersistenceModule],
})
export class NotificationsModule {}