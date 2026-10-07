import { UploadedAdvancedPhoto } from '../../../../domain/uploaded-advanced-photo';
import { UploadedAdvancedPhotoEntity } from '../entities/uploaded-advanced-photo.entity';
import { AdvancedPhotoMapper } from '../../../../../advanced-photo/infrastructure/persistence/relational/mappers/advanced-photo.mapper';
import { FileMapper } from '../../../../../files/infrastructure/persistence/relational/mappers/file.mapper';
import { ReportMapper } from '../../../../../report/infrastructure/persistence/relational/mappers/report.mapper';

export class UploadedAdvancedPhotoMapper {
  static toDomain(raw: UploadedAdvancedPhotoEntity): UploadedAdvancedPhoto {
    const domainEntity = new UploadedAdvancedPhoto();
    domainEntity.id = raw.id;
    if (raw.advancedPhoto) {
      domainEntity.advancedPhoto = AdvancedPhotoMapper.toDomain(
        raw.advancedPhoto,
      );
    }
    if (raw.file) {
      domainEntity.file = FileMapper.toDomain(raw.file);
    }
    if (raw.report) {
      domainEntity.report = ReportMapper.toDomain(raw.report);
    }
    domainEntity.label = raw.label;
    domainEntity.createdAt = raw.createdAt;
    domainEntity.updatedAt = raw.updatedAt;
    domainEntity.beforeAfterType = raw.beforeAfterType;
    domainEntity.order = raw.order;
    return domainEntity;
  }

  static toPersistence(
    domainEntity: UploadedAdvancedPhoto,
  ): UploadedAdvancedPhotoEntity {
    const persistenceEntity = new UploadedAdvancedPhotoEntity();
    if (domainEntity.id) {
      persistenceEntity.id = domainEntity.id;
    }
    if (domainEntity.advancedPhoto) {
      persistenceEntity.advancedPhoto = AdvancedPhotoMapper.toPersistence(
        domainEntity.advancedPhoto,
      );
    }
    if (domainEntity.file) {
      persistenceEntity.file = FileMapper.toPersistence(domainEntity.file);
    }
    if (domainEntity.report) {
      persistenceEntity.report = ReportMapper.toPersistence(
        domainEntity.report,
      );
    }
    persistenceEntity.label = domainEntity.label;
    persistenceEntity.createdAt = domainEntity.createdAt;
    persistenceEntity.updatedAt = domainEntity.updatedAt;
    persistenceEntity.beforeAfterType = domainEntity.beforeAfterType;
    persistenceEntity.order = domainEntity.order ?? 0;
    return persistenceEntity;
  }
}
