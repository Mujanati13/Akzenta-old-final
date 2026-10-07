import { UploadedPhoto } from '../../../../domain/uploaded-photo';
import { UploadedPhotoEntity } from '../entities/uploaded-photo.entity';
import { PhotoMapper } from '../../../../../photo/infrastructure/persistence/relational/mappers/photo.mapper';
import { FileMapper } from '../../../../../files/infrastructure/persistence/relational/mappers/file.mapper';
import { ReportMapper } from '../../../../../report/infrastructure/persistence/relational/mappers/report.mapper';

export class UploadedPhotoMapper {
  static toDomain(raw: UploadedPhotoEntity): UploadedPhoto {
    const domainEntity = new UploadedPhoto();
    domainEntity.id = raw.id;
    if (raw.photo) {
      domainEntity.photo = PhotoMapper.toDomain(raw.photo);
    }
    if (raw.file) {
      domainEntity.file = FileMapper.toDomain(raw.file);
    }
    if (raw.report) {
      domainEntity.report = ReportMapper.toDomain(raw.report);
    }
    domainEntity.createdAt = raw.createdAt;
    domainEntity.updatedAt = raw.updatedAt;
    return domainEntity;
  }

  static toPersistence(domainEntity: UploadedPhoto): UploadedPhotoEntity {
    const persistenceEntity = new UploadedPhotoEntity();
    if (domainEntity.id) {
      persistenceEntity.id = domainEntity.id;
    }
    if (domainEntity.photo) {
      persistenceEntity.photo = PhotoMapper.toPersistence(domainEntity.photo);
    }
    if (domainEntity.file) {
      persistenceEntity.file = FileMapper.toPersistence(domainEntity.file);
    }
    if (domainEntity.report) {
      persistenceEntity.report = ReportMapper.toPersistence(
        domainEntity.report,
      );
    }
    persistenceEntity.createdAt = domainEntity.createdAt;
    persistenceEntity.updatedAt = domainEntity.updatedAt;
    return persistenceEntity;
  }
}
