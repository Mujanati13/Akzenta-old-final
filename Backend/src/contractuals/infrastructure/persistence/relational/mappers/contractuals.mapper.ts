import { Contractuals } from '../../../../domain/contractuals';
import { ContractualsEntity } from '../entities/contractuals.entity';

export class ContractualsMapper {
  static toDomain(raw: ContractualsEntity): Contractuals {
    const domainEntity = new Contractuals();
    domainEntity.id = raw.id;
    domainEntity.name = raw.name;
    // domainEntity.createdAt = raw.createdAt;
    // domainEntity.updatedAt = raw.updatedAt;

    return domainEntity;
  }

  static toPersistence(domainEntity: Contractuals): ContractualsEntity {
    const persistenceEntity = new ContractualsEntity();
    if (domainEntity.id) {
      persistenceEntity.id = domainEntity.id;
    }
    persistenceEntity.name = domainEntity.name;
    persistenceEntity.createdAt = domainEntity.createdAt;
    persistenceEntity.updatedAt = domainEntity.updatedAt;

    return persistenceEntity;
  }
}