import { MerchandiserMapper } from '../../../../../merchandiser/infrastructure/persistence/relational/mappers/merchandiser.mapper';
import { SpecializationsMapper } from '../../../../../specializations/infrastructure/persistence/relational/mappers/specializations.mapper';
import { MerchandiserSpecializations } from '../../../../domain/merchandiser-specializations';
import { MerchandiserSpecializationsEntity } from '../entities/merchandiser-specializations.entity';

export class MerchandiserSpecializationsMapper {
  static toDomain(raw: MerchandiserSpecializationsEntity): MerchandiserSpecializations {
    const domainEntity = new MerchandiserSpecializations();
    domainEntity.id = raw.id;
    domainEntity.specialization = SpecializationsMapper.toDomain(raw.specialization);
    domainEntity.createdAt = raw.createdAt;
    domainEntity.updatedAt = raw.updatedAt;

    return domainEntity;
  }

  static toPersistence(domainEntity: MerchandiserSpecializations): MerchandiserSpecializationsEntity {
    const persistenceEntity = new MerchandiserSpecializationsEntity();
    if (domainEntity.id) {
      persistenceEntity.id = domainEntity.id;
    }
    persistenceEntity.merchandiser = MerchandiserMapper.toPersistence(domainEntity.merchandiser);
    persistenceEntity.specialization = SpecializationsMapper.toPersistence(domainEntity.specialization);
    persistenceEntity.createdAt = domainEntity.createdAt;
    persistenceEntity.updatedAt = domainEntity.updatedAt;

    return persistenceEntity;
  }
}