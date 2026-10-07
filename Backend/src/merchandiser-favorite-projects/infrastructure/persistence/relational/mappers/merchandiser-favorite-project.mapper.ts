import { MerchandiserFavoriteProject } from '../../../../domain/merchandiser-favorite-project';
import { MerchandiserFavoriteProjectEntity } from '../entities/merchandiser-favorite-project.entity';
import { MerchandiserMapper } from '../../../../../merchandiser/infrastructure/persistence/relational/mappers/merchandiser.mapper';
import { ProjectMapper } from '../../../../../project/infrastructure/persistence/relational/mappers/project.mapper';

export class MerchandiserFavoriteProjectMapper {
  static toDomain(raw: MerchandiserFavoriteProjectEntity): MerchandiserFavoriteProject {
    const domainEntity = new MerchandiserFavoriteProject();
    domainEntity.id = raw.id;
    if (raw.merchandiser) {
      domainEntity.merchandiser = MerchandiserMapper.toDomain(raw.merchandiser);
    }
    if (raw.project) {
      domainEntity.project = ProjectMapper.toDomain(raw.project);
    }
    domainEntity.createdAt = raw.createdAt;
    domainEntity.updatedAt = raw.updatedAt;
    return domainEntity;
  }

  static toPersistence(domainEntity: MerchandiserFavoriteProject): MerchandiserFavoriteProjectEntity {
    const persistenceEntity = new MerchandiserFavoriteProjectEntity();
    if (domainEntity.id) {
      persistenceEntity.id = domainEntity.id;
    }
    if (domainEntity.merchandiser) {
      persistenceEntity.merchandiser = MerchandiserMapper.toPersistence(domainEntity.merchandiser);
    }
    if (domainEntity.project) {
      persistenceEntity.project = ProjectMapper.toPersistence(domainEntity.project);
    }
    persistenceEntity.createdAt = domainEntity.createdAt;
    persistenceEntity.updatedAt = domainEntity.updatedAt;
    return persistenceEntity;
  }
}
