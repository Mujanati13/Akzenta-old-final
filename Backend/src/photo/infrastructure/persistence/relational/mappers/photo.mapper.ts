import { Photo } from '../../../../domain/photo';
import { PhotoEntity } from '../entities/photo.entity';
import { ProjectMapper } from '../../../../../project/infrastructure/persistence/relational/mappers/project.mapper';

export class PhotoMapper {
  static toDomain(raw: PhotoEntity): Photo {
    const domainEntity = new Photo();
    domainEntity.id = raw.id;
    if (raw.project) {
      domainEntity.project = ProjectMapper.toDomain(raw.project);
    }
    domainEntity.order = raw.order;
    domainEntity.isBeforeAfter = raw.isBeforeAfter;
    domainEntity.isVisibleInReport = raw.isVisibleInReport;
    domainEntity.createdAt = raw.createdAt;
    domainEntity.updatedAt = raw.updatedAt;
    return domainEntity;
  }

  static toPersistence(domainEntity: Photo): PhotoEntity {
    const persistenceEntity = new PhotoEntity();
    if (domainEntity.id) {
      persistenceEntity.id = domainEntity.id;
    }
    if (domainEntity.project) {
      persistenceEntity.project = ProjectMapper.toPersistence(
        domainEntity.project,
      );
    }
    persistenceEntity.order = domainEntity.order;
    persistenceEntity.isBeforeAfter = domainEntity.isBeforeAfter;
    persistenceEntity.isVisibleInReport = domainEntity.isVisibleInReport
    persistenceEntity.createdAt = domainEntity.createdAt;
    persistenceEntity.updatedAt = domainEntity.updatedAt;
    return persistenceEntity;
  }
}
