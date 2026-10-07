import { CitiesMapper } from '../../../../../cities/infrastructure/persistence/relational/mappers/cities.mapper';
import { ClientCompanyMapper } from '../../../../../client-company/infrastructure/persistence/relational/mappers/client-company.mapper';
import { Branch } from '../../../../domain/branch';
import { BranchEntity } from '../entities/branch.entity';

export class BranchMapper {
  static toDomain(raw: BranchEntity): Branch {
    const domainEntity = new Branch();
    domainEntity.id = raw.id;
    domainEntity.name = raw.name;
    domainEntity.branchNumber = raw.branchNumber;
    domainEntity.street = raw.street;
    domainEntity.zipCode = raw.zipCode;
    domainEntity.phone = raw.phone;
    if (raw.client) {
      domainEntity.client = ClientCompanyMapper.toDomain(raw.client);
    }
    if (raw.city) {
      domainEntity.city = CitiesMapper.toDomain(raw.city);
    }
    domainEntity.createdAt = raw.createdAt;
    domainEntity.updatedAt = raw.updatedAt;
    return domainEntity;
  }

  static toPersistence(domainEntity: Branch): BranchEntity {
    const persistenceEntity = new BranchEntity();
    if (domainEntity.id) {
      persistenceEntity.id = domainEntity.id;
    }
    persistenceEntity.name = domainEntity.name;
    persistenceEntity.street = domainEntity.street;
    persistenceEntity.zipCode = domainEntity.zipCode;
    persistenceEntity.phone = domainEntity.phone;
    if (domainEntity.client) {
      persistenceEntity.client = ClientCompanyMapper.toPersistence(domainEntity.client);
    }
    if (domainEntity.city) {
      persistenceEntity.city = CitiesMapper.toPersistence(domainEntity.city);
    }
    persistenceEntity.branchNumber = domainEntity.branchNumber;
    persistenceEntity.createdAt = domainEntity.createdAt;
    persistenceEntity.updatedAt = domainEntity.updatedAt;
    return persistenceEntity;
  }
}
