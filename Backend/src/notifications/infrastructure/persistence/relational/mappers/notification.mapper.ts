import { UserEntity } from '../../../../../users/infrastructure/persistence/relational/entities/user.entity';
import { ConversationEntity } from '../../../../../conversation/infrastructure/persistence/relational/entities/conversation.entity';
import { Notification } from '../../../../domain/notification';
import { NotificationEntity } from '../entities/notification.entity';

export class NotificationMapper {
  static toDomain(raw: NotificationEntity): Notification {
    const domainEntity = new Notification();
    domainEntity.id = raw.id;
    domainEntity.message = raw.message;
    domainEntity.seen = raw.seen;
    domainEntity.link = raw.link;
    
    if (raw.conversation) {
      domainEntity.conversation = {
        id: raw.conversation.id,
        reportId: raw.conversation.report?.id || 0,
        createdAt: raw.conversation.createdAt,
        updatedAt: raw.conversation.updatedAt,
      };
    }
    
    domainEntity.createdAt = raw.createdAt;
    domainEntity.updatedAt = raw.updatedAt;
    domainEntity.deletedAt = raw.deletedAt;
    return domainEntity;
  }

  static toPersistence(domainEntity: Notification): NotificationEntity {
    let user: UserEntity | undefined = undefined;
    let conversation: ConversationEntity | undefined = undefined;

    if (domainEntity.user) {
      user = new UserEntity();
      user.id = Number(domainEntity.user.id);
    }

    if (domainEntity.conversation) {
      conversation = new ConversationEntity();
      conversation.id = Number(domainEntity.conversation.id);
    }

    const persistenceEntity = new NotificationEntity();
    // Only set ID for existing entities (when createdAt exists and ID is valid)
    if (domainEntity.id && domainEntity.createdAt && domainEntity.id !== 0 && domainEntity.id !== '0') {
      persistenceEntity.id = Number(domainEntity.id);
    }
    persistenceEntity.message = domainEntity.message;
    persistenceEntity.seen = domainEntity.seen;
    persistenceEntity.link = domainEntity.link;
    persistenceEntity.user = user!;
    persistenceEntity.conversation = conversation;
    persistenceEntity.createdAt = domainEntity.createdAt;
    persistenceEntity.updatedAt = domainEntity.updatedAt;
    persistenceEntity.deletedAt = domainEntity.deletedAt;
    return persistenceEntity;
  }
}