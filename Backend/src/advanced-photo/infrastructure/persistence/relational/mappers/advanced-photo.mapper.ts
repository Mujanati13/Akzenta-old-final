import { AdvancedPhoto } from '../../../../domain/advanced-photo';
import { AdvancedPhotoEntity } from '../entities/advanced-photo.entity';
import { ProjectMapper } from '../../../../../project/infrastructure/persistence/relational/mappers/project.mapper';

export class AdvancedPhotoMapper {
  static toDomain(raw: AdvancedPhotoEntity): AdvancedPhoto {
    const domainEntity = new AdvancedPhoto();
    domainEntity.id = raw.id;
    if (raw.project) {
      domainEntity.project = ProjectMapper.toDomain(raw.project);
    }
    domainEntity.labels = raw.labels;
    domainEntity.isBeforeAfter = raw.isBeforeAfter;
    domainEntity.isVisibleInReport = raw.isVisibleInReport;
    domainEntity.beforeImageCount = raw.beforeImageCount;
    domainEntity.afterImageCount = raw.afterImageCount;
    domainEntity.createdAt = raw.createdAt;
    domainEntity.updatedAt = raw.updatedAt;
    return domainEntity;
  }

  static toPersistence(domainEntity: AdvancedPhoto): AdvancedPhotoEntity {
    const persistenceEntity = new AdvancedPhotoEntity();
    if (domainEntity.id) {
      persistenceEntity.id = domainEntity.id;
    }
    if (domainEntity.project) {
      persistenceEntity.project = ProjectMapper.toPersistence(
        domainEntity.project,
      );
    }
    persistenceEntity.labels = domainEntity.labels;
    persistenceEntity.isBeforeAfter = domainEntity.isBeforeAfter;
    persistenceEntity.isVisibleInReport = domainEntity.isVisibleInReport;
    persistenceEntity.beforeImageCount = domainEntity.beforeImageCount;
    persistenceEntity.afterImageCount = domainEntity.afterImageCount;
    persistenceEntity.createdAt = domainEntity.createdAt;
    persistenceEntity.updatedAt = domainEntity.updatedAt;
    return persistenceEntity;
  }
}
