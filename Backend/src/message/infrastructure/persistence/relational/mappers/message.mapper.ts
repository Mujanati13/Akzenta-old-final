import { Message } from '../../../../domain/message';
import { MessageEntity } from '../entities/message.entity';
import { FileMapper } from '../../../../../files/infrastructure/persistence/relational/mappers/file.mapper';
import { ConversationMapper } from '../../../../../conversation/infrastructure/persistence/relational/mappers/conversation.mapper';
import { UserTypeEntity } from '../../../../../user-type/infrastructure/persistence/relational/entities/user-type.entity';

export class MessageMapper {
  static toDomain(raw: MessageEntity): Message {
    const domainEntity = new Message({});
    domainEntity.id = raw.id;
    domainEntity.conversationId = raw.conversation?.id;
    domainEntity.senderId = raw.sender?.id;
    domainEntity.senderFirstName = raw.sender?.firstName ?? null;
    domainEntity.senderLastName = raw.sender?.lastName ?? null;
    if (raw.sender?.type) {
      domainEntity.senderType = this.mapUserType(raw.sender.type);
    }
    if (raw.sender?.photo) {
      domainEntity.senderPhoto = FileMapper.toDomain(raw.sender.photo);
    }
    domainEntity.receiverId = raw.receiver?.id;
    domainEntity.receiverFirstName = raw.receiver?.firstName ?? null;
    domainEntity.receiverLastName = raw.receiver?.lastName ?? null;
    if (raw.receiver?.type) {
      domainEntity.receiverType = this.mapUserType(raw.receiver.type);
    }
    if (raw.receiver?.photo) {
      domainEntity.receiverPhoto = FileMapper.toDomain(raw.receiver.photo);
    }
    domainEntity.content = raw.content;
    domainEntity.seen = raw.seen;
    domainEntity.receiverTypeString = raw.receiverType;
    domainEntity.createdAt = raw.createdAt;
    domainEntity.updatedAt = raw.updatedAt;
    return domainEntity;
  }

  private static mapUserType(userTypeEntity: UserTypeEntity) {
    return {
      id: userTypeEntity.id,
      name: userTypeEntity.name
    };
  }

  static toPersistence(domainEntity: Message | Omit<Message, 'id' | 'createdAt' | 'updatedAt'>): MessageEntity {
    const persistenceEntity = new MessageEntity();
    if ('id' in domainEntity && domainEntity.id) {
      persistenceEntity.id = domainEntity.id;
    }
    persistenceEntity.content = domainEntity.content;
    persistenceEntity.seen = domainEntity.seen;
    persistenceEntity.receiverType = domainEntity.receiverTypeString;
    if ('createdAt' in domainEntity) {
      persistenceEntity.createdAt = domainEntity.createdAt;
    }
    if ('updatedAt' in domainEntity) {
      persistenceEntity.updatedAt = domainEntity.updatedAt;
    }
    return persistenceEntity;
  }
}