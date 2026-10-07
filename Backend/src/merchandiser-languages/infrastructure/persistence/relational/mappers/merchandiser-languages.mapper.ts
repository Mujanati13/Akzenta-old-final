import { LanguagesMapper } from '../../../../../languages/infrastructure/persistence/relational/mappers/languages.mapper';
import { MerchandiserMapper } from '../../../../../merchandiser/infrastructure/persistence/relational/mappers/merchandiser.mapper';
import { MerchandiserLanguages } from '../../../../domain/merchandiser-languages';
import { MerchandiserLanguagesEntity } from '../entities/merchandiser-languages.entity';

export class MerchandiserLanguagesMapper {
  static toDomain(raw: MerchandiserLanguagesEntity): MerchandiserLanguages {
    const domainEntity = new MerchandiserLanguages();
    domainEntity.id = raw.id;
    if (raw.merchandiser) {
      domainEntity.merchandiser = MerchandiserMapper.toDomain(raw.merchandiser);
    }
    domainEntity.language = LanguagesMapper.toDomain(raw.language);
    domainEntity.level = raw.level;
    domainEntity.createdAt = raw.createdAt;
    domainEntity.updatedAt = raw.updatedAt;

    return domainEntity;
  }

  static toPersistence(domainEntity: MerchandiserLanguages): MerchandiserLanguagesEntity {
    const persistenceEntity = new MerchandiserLanguagesEntity();
    if (domainEntity.id) {
      persistenceEntity.id = domainEntity.id;
    }
    persistenceEntity.merchandiser = MerchandiserMapper.toPersistence(domainEntity.merchandiser);
    persistenceEntity.language = LanguagesMapper.toPersistence(domainEntity.language);
    persistenceEntity.level = domainEntity.level;
    persistenceEntity.createdAt = domainEntity.createdAt;
    persistenceEntity.updatedAt = domainEntity.updatedAt;

    return persistenceEntity;
  }
}