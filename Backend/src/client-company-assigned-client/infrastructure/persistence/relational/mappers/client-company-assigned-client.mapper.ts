import { ClientCompanyAssignedClient } from '../../../../domain/client-company-assigned-client';
import { ClientCompanyAssignedClientEntity } from '../entities/client-company-assigned-client.entity';
import { ClientMapper } from '../../../../../client/infrastructure/persistence/relational/mappers/client.mapper';
import { ClientCompanyMapper } from '../../../../../client-company/infrastructure/persistence/relational/mappers/client-company.mapper';

export class ClientCompanyAssignedClientMapper {
  static toDomain(raw: ClientCompanyAssignedClientEntity): ClientCompanyAssignedClient {
    const domainEntity = new ClientCompanyAssignedClient();
    domainEntity.id = raw.id;
    if (raw.client) {
      domainEntity.client = ClientMapper.toDomain(raw.client);
    }
    if (raw.clientCompany) {
      domainEntity.clientCompany = ClientCompanyMapper.toDomain(raw.clientCompany);
    }
    domainEntity.createdAt = raw.createdAt;
    domainEntity.updatedAt = raw.updatedAt;
    return domainEntity;
  }

  static toPersistence(domainEntity: ClientCompanyAssignedClient): ClientCompanyAssignedClientEntity {
    const persistenceEntity = new ClientCompanyAssignedClientEntity();
    if (domainEntity.id) {
      persistenceEntity.id = domainEntity.id;
    }
    if (domainEntity.client) {
      persistenceEntity.client = ClientMapper.toPersistence(domainEntity.client);
    }
    if (domainEntity.clientCompany) {
      persistenceEntity.clientCompany = ClientCompanyMapper.toPersistence(domainEntity.clientCompany);
    }
    persistenceEntity.createdAt = domainEntity.createdAt;
    persistenceEntity.updatedAt = domainEntity.updatedAt;
    return persistenceEntity;
  }
}