import { AkzenteFavoriteClient } from '../../../../domain/akzente-favorite-client';
import { AkzenteFavoriteClientEntity } from '../entities/akzente-favorite-client.entity';
import { AkzenteMapper } from '../../../../../akzente/infrastructure/persistence/relational/mappers/akzente.mapper';
import { ClientMapper } from '../../../../../client/infrastructure/persistence/relational/mappers/client.mapper';

export class AkzenteFavoriteClientMapper {
  static toDomain(raw: AkzenteFavoriteClientEntity): AkzenteFavoriteClient {
    const domainEntity = new AkzenteFavoriteClient();
    domainEntity.id = raw.id;
    if (raw.akzente) {
      domainEntity.akzente = AkzenteMapper.toDomain(raw.akzente);
    }
    if (raw.client) {
      domainEntity.client = ClientMapper.toDomain(raw.client);
    }
    domainEntity.createdAt = raw.createdAt;
    domainEntity.updatedAt = raw.updatedAt;
    return domainEntity;
  }

  static toPersistence(domainEntity: AkzenteFavoriteClient): AkzenteFavoriteClientEntity {
    const persistenceEntity = new AkzenteFavoriteClientEntity();
    if (domainEntity.id) {
      persistenceEntity.id = domainEntity.id;
    }
    if (domainEntity.akzente) {
      persistenceEntity.akzente = AkzenteMapper.toPersistence(domainEntity.akzente);
    }
    if (domainEntity.client) {
      persistenceEntity.client = ClientMapper.toPersistence(domainEntity.client);
    }
    persistenceEntity.createdAt = domainEntity.createdAt;
    persistenceEntity.updatedAt = domainEntity.updatedAt;
    return persistenceEntity;
  }
}