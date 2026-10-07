import { FileMapper } from '../../../../../files/infrastructure/persistence/relational/mappers/file.mapper';
import { MerchandiserMapper } from '../../../../../merchandiser/infrastructure/persistence/relational/mappers/merchandiser.mapper';
import { MerchandiserFiles } from '../../../../domain/merchandiser-files';
import { MerchandiserFilesEntity } from '../entities/merchandiser-files.entity';

export class MerchandiserFilesMapper {
  static toDomain(raw: MerchandiserFilesEntity): MerchandiserFiles {
    const domainEntity = new MerchandiserFiles();
    domainEntity.id = raw.id;
    // Only include merchandiser if it's loaded (for internal operations)
    if (raw.merchandiser) {
      domainEntity.merchandiser = MerchandiserMapper.toDomain(raw.merchandiser);
    }
    domainEntity.file = FileMapper.toDomain(raw.file);
    domainEntity.type = raw.type;
    domainEntity.name = raw.name;
    domainEntity.createdAt = raw.createdAt;
    domainEntity.updatedAt = raw.updatedAt;

    return domainEntity;
  }

  static toPersistence(domainEntity: MerchandiserFiles): MerchandiserFilesEntity {
    const persistenceEntity = new MerchandiserFilesEntity();
    if (domainEntity.id) {
      persistenceEntity.id = domainEntity.id;
    }
    if (domainEntity.merchandiser) {
      persistenceEntity.merchandiser = MerchandiserMapper.toPersistence(domainEntity.merchandiser);
    }
    persistenceEntity.file = FileMapper.toPersistence(domainEntity.file);
    persistenceEntity.type = domainEntity.type ?? null;
    persistenceEntity.name = domainEntity.name ?? null;
    persistenceEntity.createdAt = domainEntity.createdAt;
    persistenceEntity.updatedAt = domainEntity.updatedAt;

    return persistenceEntity;
  }

  // Add a method specifically for API responses that excludes merchandiser
  static toDomainForResponse(raw: MerchandiserFilesEntity): Omit<MerchandiserFiles, 'merchandiser'> {
    return {
      id: raw.id,
      file: FileMapper.toDomain(raw.file),
      type: raw.type,
      name: raw.name,
      createdAt: raw.createdAt,
      updatedAt: raw.updatedAt,
    };
  }
}