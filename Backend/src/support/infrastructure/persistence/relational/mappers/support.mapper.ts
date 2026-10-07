import { Support } from '../../../../domain/support';
import { SupportEntity } from '../entities/support.entity';

export class SupportMapper {
  static toDomain(raw: SupportEntity): Support {
    const domainEntity = new Support();
    domainEntity.id = raw.id;
    domainEntity.email = raw.email;
    domainEntity.createdAt = raw.createdAt;
    domainEntity.updatedAt = raw.updatedAt;

    return domainEntity;
  }

  static toPersistence(domainEntity: Support): SupportEntity {
    const persistenceEntity = new SupportEntity();
    if (domainEntity.id) {
      persistenceEntity.id = domainEntity.id;
    }
    persistenceEntity.email = domainEntity.email;
    persistenceEntity.createdAt = domainEntity.createdAt;
    persistenceEntity.updatedAt = domainEntity.updatedAt;

    return persistenceEntity;
  }
}

