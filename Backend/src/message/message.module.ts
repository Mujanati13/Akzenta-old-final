import { Module } from '@nestjs/common';
import { MessageController } from './message.controller';
import { MessageService } from './message.service';
import { RelationalMessagePersistenceModule } from './infrastructure/persistence/relational/relational-persistence.module';
import { SessionModule } from '../session/session.module';

const infrastructurePersistenceModule = RelationalMessagePersistenceModule;

@Module({
  imports: [infrastructurePersistenceModule, SessionModule],
  controllers: [MessageController],
  providers: [MessageService],
  exports: [MessageService, infrastructurePersistenceModule],
})
export class MessageModule {}