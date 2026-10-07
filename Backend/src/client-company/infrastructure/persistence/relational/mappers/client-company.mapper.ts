import { ClientCompany } from '../../../../domain/client-company';
import { ClientCompanyEntity } from '../entities/client-company.entity';
import { FileMapper } from '../../../../../files/infrastructure/persistence/relational/mappers/file.mapper';
import { FileEntity } from '../../../../../files/infrastructure/persistence/relational/entities/file.entity';

export class ClientCompanyMapper {
  static toDomain(raw: ClientCompanyEntity): ClientCompany {
    const domainEntity = new ClientCompany();
    domainEntity.id = raw.id;
    if (raw.logo) {
      domainEntity.logo = FileMapper.toDomain(raw.logo);
    }
    domainEntity.name = raw.name;
    domainEntity.createdAt = raw.createdAt;
    domainEntity.updatedAt = raw.updatedAt;
    return domainEntity;
  }

  static toPersistence(domainEntity: ClientCompany): ClientCompanyEntity {
    const persistenceEntity = new ClientCompanyEntity();
    if (domainEntity.id) {
      persistenceEntity.id = domainEntity.id;
    }

    let logo: FileEntity | undefined | null = undefined;

    if (domainEntity.logo) {
      logo = new FileEntity();
      logo.id = domainEntity.logo.id;
      logo.path = domainEntity.logo.path;
    } else if (domainEntity.logo === null) {
      logo = null;
    }

    persistenceEntity.name = domainEntity.name;
    persistenceEntity.logo = logo;
    persistenceEntity.createdAt = domainEntity.createdAt;
    persistenceEntity.updatedAt = domainEntity.updatedAt;
    return persistenceEntity;
  }
}
