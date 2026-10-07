import { SupportMail } from '../../../../domain/support-mail';
import { SupportMailEntity } from '../entities/support-mail.entity';
import { ClientMapper } from '../../../../../client/infrastructure/persistence/relational/mappers/client.mapper';

export class SupportMailMapper {
  static toDomain(raw: SupportMailEntity): SupportMail {
    const domainEntity = new SupportMail();
    domainEntity.id = raw.id;
    domainEntity.subject = raw.subject;
    domainEntity.content = raw.content;
    if (raw.client) {
      domainEntity.client = ClientMapper.toDomain(raw.client);
    }
    domainEntity.createdAt = raw.createdAt;
    domainEntity.updatedAt = raw.updatedAt;

    return domainEntity;
  }

  static toPersistence(domainEntity: SupportMail): SupportMailEntity {
    const persistenceEntity = new SupportMailEntity();
    if (domainEntity.id) {
      persistenceEntity.id = domainEntity.id;
    }
    persistenceEntity.subject = domainEntity.subject;
    persistenceEntity.content = domainEntity.content;
    if (domainEntity.client) {
      persistenceEntity.client = ClientMapper.toPersistence(domainEntity.client);
    }
    persistenceEntity.createdAt = domainEntity.createdAt;
    persistenceEntity.updatedAt = domainEntity.updatedAt;

    return persistenceEntity;
  }
}

