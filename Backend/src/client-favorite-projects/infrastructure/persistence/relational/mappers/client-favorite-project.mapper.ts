import { ClientFavoriteProject } from '../../../../domain/client-favorite-project';
import { ClientFavoriteProjectEntity } from '../entities/client-favorite-project.entity';
import { ClientMapper } from '../../../../../client/infrastructure/persistence/relational/mappers/client.mapper';
import { ProjectMapper } from '../../../../../project/infrastructure/persistence/relational/mappers/project.mapper';

export class ClientFavoriteProjectMapper {
  static toDomain(raw: ClientFavoriteProjectEntity): ClientFavoriteProject {
    const domainEntity = new ClientFavoriteProject();
    domainEntity.id = raw.id;
    if (raw.client) {
      domainEntity.client = ClientMapper.toDomain(raw.client);
    }
    if (raw.project) {
      domainEntity.project = ProjectMapper.toDomain(raw.project);
    }
    domainEntity.createdAt = raw.createdAt;
    domainEntity.updatedAt = raw.updatedAt;
    return domainEntity;
  }

  static toPersistence(domainEntity: ClientFavoriteProject): ClientFavoriteProjectEntity {
    const persistenceEntity = new ClientFavoriteProjectEntity();
    if (domainEntity.id) {
      persistenceEntity.id = domainEntity.id;
    }
    if (domainEntity.client) {
      persistenceEntity.client = ClientMapper.toPersistence(domainEntity.client);
    }
    if (domainEntity.project) {
      persistenceEntity.project = ProjectMapper.toPersistence(domainEntity.project);
    }
    persistenceEntity.createdAt = domainEntity.createdAt;
    persistenceEntity.updatedAt = domainEntity.updatedAt;
    return persistenceEntity;
  }
}
