import { MerchandiserMapper } from '../../../../../merchandiser/infrastructure/persistence/relational/mappers/merchandiser.mapper';
import { MerchandiserReferences } from '../../../../domain/merchandiser-references';
import { MerchandiserReferencesEntity } from '../entities/merchandiser-references.entity';

export class MerchandiserReferencesMapper {
  static toDomain(raw: MerchandiserReferencesEntity): MerchandiserReferences {
    const domainEntity = new MerchandiserReferences();
    domainEntity.id = raw.id;
    domainEntity.company = raw.company;
    domainEntity.activity = raw.activity;
    domainEntity.branche = raw.branche;
    domainEntity.startDate = raw.startDate;
    domainEntity.endDate = raw.endDate;
    domainEntity.createdAt = raw.createdAt;
    domainEntity.updatedAt = raw.updatedAt;

    return domainEntity;
  }

  static toPersistence(domainEntity: MerchandiserReferences): MerchandiserReferencesEntity {
    const persistenceEntity = new MerchandiserReferencesEntity();
    if (domainEntity.id) {
      persistenceEntity.id = domainEntity.id;
    }
    persistenceEntity.merchandiser = MerchandiserMapper.toPersistence(domainEntity.merchandiser);
    persistenceEntity.company = domainEntity.company;
    persistenceEntity.activity = domainEntity.activity;
    persistenceEntity.branche = domainEntity.branche;
    persistenceEntity.startDate = domainEntity.startDate;
    persistenceEntity.endDate = domainEntity.endDate ?? null;
    persistenceEntity.createdAt = domainEntity.createdAt;
    persistenceEntity.updatedAt = domainEntity.updatedAt;

    return persistenceEntity;
  }
}