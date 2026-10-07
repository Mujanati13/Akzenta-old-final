import { JobTypesMapper } from '../../../../../job-types/infrastructure/persistence/relational/mappers/job-types.mapper';
import { Specializations } from '../../../../domain/specializations';
import { SpecializationsEntity } from '../entities/specializations.entity';

export class SpecializationsMapper {
  static toDomain(raw: SpecializationsEntity): Specializations {
    const domainEntity = new Specializations();
    domainEntity.id = raw.id;
    domainEntity.jobType = JobTypesMapper.toDomain(raw.jobType);
    domainEntity.name = raw.name;
    domainEntity.createdAt = raw.createdAt;
    domainEntity.updatedAt = raw.updatedAt;

    return domainEntity;
  }

  static toPersistence(domainEntity: Specializations): SpecializationsEntity {
    const persistenceEntity = new SpecializationsEntity();
    if (domainEntity.id) {
      persistenceEntity.id = domainEntity.id;
    }
    persistenceEntity.jobType = JobTypesMapper.toPersistence(domainEntity.jobType);
    persistenceEntity.name = domainEntity.name;
    persistenceEntity.createdAt = domainEntity.createdAt;
    persistenceEntity.updatedAt = domainEntity.updatedAt;

    return persistenceEntity;
  }
}