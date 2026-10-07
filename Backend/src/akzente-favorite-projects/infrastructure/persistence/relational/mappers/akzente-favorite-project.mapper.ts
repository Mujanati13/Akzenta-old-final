import { AkzenteFavoriteProject } from '../../../../domain/akzente-favorite-project';
import { AkzenteFavoriteProjectEntity } from '../entities/akzente-favorite-project.entity';
import { AkzenteMapper } from '../../../../../akzente/infrastructure/persistence/relational/mappers/akzente.mapper';
import { ProjectMapper } from '../../../../../project/infrastructure/persistence/relational/mappers/project.mapper';

export class AkzenteFavoriteProjectMapper {
  static toDomain(raw: AkzenteFavoriteProjectEntity): AkzenteFavoriteProject {
    const domainEntity = new AkzenteFavoriteProject();
    domainEntity.id = raw.id;
    if (raw.akzente) {
      domainEntity.akzente = AkzenteMapper.toDomain(raw.akzente);
    }
    if (raw.project) {
      domainEntity.project = ProjectMapper.toDomain(raw.project);
    }
    domainEntity.createdAt = raw.createdAt;
    domainEntity.updatedAt = raw.updatedAt;
    return domainEntity;
  }

  static toPersistence(domainEntity: AkzenteFavoriteProject): AkzenteFavoriteProjectEntity {
    const persistenceEntity = new AkzenteFavoriteProjectEntity();
    if (domainEntity.id) {
      persistenceEntity.id = domainEntity.id;
    }
    if (domainEntity.akzente) {
      persistenceEntity.akzente = AkzenteMapper.toPersistence(domainEntity.akzente);
    }
    if (domainEntity.project) {
      persistenceEntity.project = ProjectMapper.toPersistence(domainEntity.project);
    }
    persistenceEntity.createdAt = domainEntity.createdAt;
    persistenceEntity.updatedAt = domainEntity.updatedAt;
    return persistenceEntity;
  }
}
