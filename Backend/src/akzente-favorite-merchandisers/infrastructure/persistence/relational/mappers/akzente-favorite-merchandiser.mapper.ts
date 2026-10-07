import { AkzenteFavoriteMerchandiser } from '../../../../domain/akzente-favorite-merchandiser';
import { AkzenteFavoriteMerchandiserEntity } from '../entities/akzente-favorite-merchandiser.entity';
import { AkzenteMapper } from '../../../../../akzente/infrastructure/persistence/relational/mappers/akzente.mapper';
import { MerchandiserMapper } from '../../../../../merchandiser/infrastructure/persistence/relational/mappers/merchandiser.mapper';

export class AkzenteFavoriteMerchandiserMapper {
  static toDomain(raw: AkzenteFavoriteMerchandiserEntity): AkzenteFavoriteMerchandiser {
    const domainEntity = new AkzenteFavoriteMerchandiser();
    domainEntity.id = raw.id;
    if (raw.akzente) {
      domainEntity.akzente = AkzenteMapper.toDomain(raw.akzente);
    }
    if (raw.merchandiser) {
      domainEntity.merchandiser = MerchandiserMapper.toDomain(raw.merchandiser);
    }
    domainEntity.createdAt = raw.createdAt;
    domainEntity.updatedAt = raw.updatedAt;
    return domainEntity;
  }

  static toPersistence(domainEntity: AkzenteFavoriteMerchandiser): AkzenteFavoriteMerchandiserEntity {
    const persistenceEntity = new AkzenteFavoriteMerchandiserEntity();
    if (domainEntity.id) {
      persistenceEntity.id = domainEntity.id;
    }
    if (domainEntity.akzente) {
      persistenceEntity.akzente = AkzenteMapper.toPersistence(domainEntity.akzente);
    }
    if (domainEntity.merchandiser) {
      persistenceEntity.merchandiser = MerchandiserMapper.toPersistence(domainEntity.merchandiser);
    }
    persistenceEntity.createdAt = domainEntity.createdAt;
    persistenceEntity.updatedAt = domainEntity.updatedAt;
    return persistenceEntity;
  }
}