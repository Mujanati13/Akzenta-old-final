import { Module } from '@nestjs/common';
import { ConversationController } from './conversation.controller';
import { ConversationService } from './conversation.service';
import { RelationalConversationPersistenceModule } from './infrastructure/persistence/relational/relational-persistence.module';
import { SessionModule } from '../session/session.module';

const infrastructurePersistenceModule = RelationalConversationPersistenceModule;

@Module({
  imports: [infrastructurePersistenceModule, SessionModule],
  controllers: [ConversationController],
  providers: [ConversationService],
  exports: [ConversationService, infrastructurePersistenceModule],
})
export class ConversationModule {}