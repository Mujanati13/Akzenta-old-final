import { JobTypes } from '../../../../domain/job-types';
import { JobTypesEntity } from '../entities/job-types.entity';

export class JobTypesMapper {
  static toDomain(raw: JobTypesEntity): JobTypes {
    const domainEntity = new JobTypes();
    domainEntity.id = raw.id;
    domainEntity.name = raw.name;
    domainEntity.createdAt = raw.createdAt;
    domainEntity.updatedAt = raw.updatedAt;

    return domainEntity;
  }

  static toPersistence(domainEntity: JobTypes): JobTypesEntity {
    const persistenceEntity = new JobTypesEntity();
    if (domainEntity.id) {
      persistenceEntity.id = domainEntity.id;
    }
    persistenceEntity.name = domainEntity.name;
    persistenceEntity.createdAt = domainEntity.createdAt;
    persistenceEntity.updatedAt = domainEntity.updatedAt;

    return persistenceEntity;
  }
}