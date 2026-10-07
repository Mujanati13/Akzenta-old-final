import { MerchandiserMapper } from '../../../../../merchandiser/infrastructure/persistence/relational/mappers/merchandiser.mapper';
import { MerchandiserEducation } from '../../../../domain/merchandiser-education';
import { MerchandiserEducationEntity } from '../entities/merchandiser-education.entity';

export class MerchandiserEducationMapper {
  static toDomain(raw: MerchandiserEducationEntity): MerchandiserEducation {
    const domainEntity = new MerchandiserEducation();
    domainEntity.id = raw.id;
    domainEntity.company = raw.company;
    domainEntity.activity = raw.activity;
    domainEntity.graduationDate = raw.graduationDate;
    domainEntity.createdAt = raw.createdAt;
    domainEntity.updatedAt = raw.updatedAt;

    return domainEntity;
  }

  static toPersistence(domainEntity: MerchandiserEducation): MerchandiserEducationEntity {
    const persistenceEntity = new MerchandiserEducationEntity();
    if (domainEntity.id) {
      persistenceEntity.id = domainEntity.id;
    }
    persistenceEntity.merchandiser = MerchandiserMapper.toPersistence(domainEntity.merchandiser);
    persistenceEntity.company = domainEntity.company;
    persistenceEntity.activity = domainEntity.activity;
    persistenceEntity.graduationDate = domainEntity.graduationDate;
    persistenceEntity.createdAt = domainEntity.createdAt;
    persistenceEntity.updatedAt = domainEntity.updatedAt;

    return persistenceEntity;
  }
}