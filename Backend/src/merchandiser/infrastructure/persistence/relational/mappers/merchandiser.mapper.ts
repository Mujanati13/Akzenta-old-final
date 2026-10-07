import { UserMapper } from '../../../../../users/infrastructure/persistence/relational/mappers/user.mapper';
import { JobTypesMapper } from '../../../../../job-types/infrastructure/persistence/relational/mappers/job-types.mapper';
import { CitiesMapper } from '../../../../../cities/infrastructure/persistence/relational/mappers/cities.mapper';
import { Merchandiser } from '../../../../domain/merchandiser';
import { MerchandiserEntity } from '../entities/merchandiser.entity';
import { ContractualsMapper } from '../../../../../contractuals/infrastructure/persistence/relational/mappers/contractuals.mapper';
import { MerchandiserStatusEntity } from '../../../../../merchandiser-statuses/infrastructure/persistence/relational/entities/status.entity';
import { MerchandiserJobTypesEntity } from '../../../../../merchandiser-job-types/infrastructure/persistence/relational/entities/merchandiser-job-types.entity';

export class MerchandiserMapper {
  static toDomain(raw: MerchandiserEntity): Merchandiser {
    const domainEntity = new Merchandiser();
    domainEntity.id = raw.id;
    if (raw.user) {
      domainEntity.user = UserMapper.toDomain(raw.user);
    }
    domainEntity.birthday = raw.birthday;
    domainEntity.website = raw.website;
    domainEntity.street = raw.street;
    domainEntity.zipCode = raw.zipCode;
    domainEntity.tax_id = raw.tax_id;
    domainEntity.tax_no = raw.tax_no;
    domainEntity.status = raw.status;
    if (raw.city) {
      domainEntity.city = CitiesMapper.toDomain(raw.city);
    }
    domainEntity.nationality = raw.nationality;
    domainEntity.deliveryStreet = raw.deliveryStreet;
    domainEntity.deliveryZipCode = raw.deliveryZipCode;
    domainEntity.deliveryCountry = raw.deliveryCountry;
    domainEntity.secondaryResidence = raw.secondaryResidence;
    domainEntity.secondaryZipCode = raw.secondaryZipCode;
    domainEntity.secondaryCountry = raw.secondaryCountry;
    if (raw.contractuals) {
      domainEntity.contractuals = raw.contractuals.map((contractual) =>
        ContractualsMapper.toDomain(contractual),
      );
    }
    if (raw.jobTypes) {
      domainEntity.jobTypes = raw.jobTypes
        .filter((mjt: MerchandiserJobTypesEntity) => mjt.jobType)
        .map((mjt: MerchandiserJobTypesEntity) =>
          JobTypesMapper.toDomain(mjt.jobType)
        );
    }
    domainEntity.createdAt = raw.createdAt;
    domainEntity.updatedAt = raw.updatedAt;
    return domainEntity;
  }

  static toPersistence(domainEntity: Merchandiser): MerchandiserEntity {
    const persistenceEntity = new MerchandiserEntity();
    if (domainEntity.id) {
      persistenceEntity.id = domainEntity.id;
    }
    if (domainEntity.user) {
      persistenceEntity.user = UserMapper.toPersistence(domainEntity.user);
    }
    persistenceEntity.birthday = domainEntity.birthday;
    persistenceEntity.website = domainEntity.website;
    persistenceEntity.street = domainEntity.street;
    persistenceEntity.zipCode = domainEntity.zipCode;
    persistenceEntity.tax_id = domainEntity.tax_id || '';
    persistenceEntity.tax_no = domainEntity.tax_no || '';
    if (domainEntity.city) {
      persistenceEntity.city = CitiesMapper.toPersistence(domainEntity.city);
    }
    let status: MerchandiserStatusEntity | undefined = undefined;
    if (domainEntity.status) {
      status = new MerchandiserStatusEntity();
      status.id = Number(domainEntity.status.id);
    }
    persistenceEntity.status = status;
    persistenceEntity.nationality = domainEntity.nationality;
    persistenceEntity.deliveryStreet = domainEntity.deliveryStreet;
    persistenceEntity.deliveryZipCode = domainEntity.deliveryZipCode;
    persistenceEntity.deliveryCountry = domainEntity.deliveryCountry;
    persistenceEntity.secondaryResidence = domainEntity.secondaryResidence;
    persistenceEntity.secondaryZipCode = domainEntity.secondaryZipCode;
    persistenceEntity.secondaryCountry = domainEntity.secondaryCountry;
    if (domainEntity.contractuals) {
      persistenceEntity.contractuals = domainEntity.contractuals.map((contractual) =>
        ContractualsMapper.toPersistence(contractual),
      );
    }
    persistenceEntity.createdAt = domainEntity.createdAt;
    persistenceEntity.updatedAt = domainEntity.updatedAt;
    return persistenceEntity;
  }
}
