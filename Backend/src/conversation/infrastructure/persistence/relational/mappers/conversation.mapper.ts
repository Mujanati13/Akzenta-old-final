import { Conversation } from '../../../../domain/conversation';
import { ConversationEntity } from '../entities/conversation.entity';
import { MessageMapper } from '../../../../../message/infrastructure/persistence/relational/mappers/message.mapper';

export class ConversationMapper {
  static toDomain(raw: ConversationEntity): Conversation {
    const domainEntity = new Conversation({});
    domainEntity.id = raw.id;
    domainEntity.reportId = raw.report?.id;
    domainEntity.createdAt = raw.createdAt;
    domainEntity.updatedAt = raw.updatedAt;
    if (raw.messages) {
      domainEntity.messages = raw.messages.map(msg => MessageMapper.toDomain(msg));
    }
    return domainEntity;
  }

  static toPersistence(domainEntity: Conversation | Omit<Conversation, 'id' | 'createdAt' | 'updatedAt'>): ConversationEntity {
    const persistenceEntity = new ConversationEntity();
    if ('id' in domainEntity && domainEntity.id) {
      persistenceEntity.id = domainEntity.id;
    }
    if ('createdAt' in domainEntity) {
      persistenceEntity.createdAt = domainEntity.createdAt;
    }
    if ('updatedAt' in domainEntity) {
      persistenceEntity.updatedAt = domainEntity.updatedAt;
    }
    return persistenceEntity;
  }
}