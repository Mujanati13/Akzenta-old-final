import { JobTypesMapper } from '../../../../../job-types/infrastructure/persistence/relational/mappers/job-types.mapper';
import { MerchandiserMapper } from '../../../../../merchandiser/infrastructure/persistence/relational/mappers/merchandiser.mapper';
import { MerchandiserJobTypes } from '../../../../domain/merchandiser-job-types';
import { MerchandiserJobTypesEntity } from '../entities/merchandiser-job-types.entity';

export class MerchandiserJobTypesMapper {
  static toDomain(raw: MerchandiserJobTypesEntity): MerchandiserJobTypes {
    const domainEntity = new MerchandiserJobTypes();
    domainEntity.id = raw.id;
    domainEntity.jobType = JobTypesMapper.toDomain(raw.jobType);
    domainEntity.comment = raw.comment;

    return domainEntity;
  }

  static toPersistence(domainEntity: MerchandiserJobTypes): MerchandiserJobTypesEntity {
    const persistenceEntity = new MerchandiserJobTypesEntity();
    if (domainEntity.id) {
      persistenceEntity.id = domainEntity.id;
    }
    persistenceEntity.merchandiser = MerchandiserMapper.toPersistence(domainEntity.merchandiser);
    persistenceEntity.jobType = JobTypesMapper.toPersistence(domainEntity.jobType);
    persistenceEntity.comment = domainEntity.comment;

    return persistenceEntity;
  }
}