import { ClientCompanyAssignedAkzente } from '../../../../domain/client-company-assigned-akzente';
import { ClientCompanyAssignedAkzenteEntity } from '../entities/client-company-assigned-akzente.entity';
import { AkzenteMapper } from '../../../../../akzente/infrastructure/persistence/relational/mappers/akzente.mapper';
import { ClientCompanyMapper } from '../../../../../client-company/infrastructure/persistence/relational/mappers/client-company.mapper';

export class ClientCompanyAssignedAkzenteMapper {
  static toDomain(raw: ClientCompanyAssignedAkzenteEntity): ClientCompanyAssignedAkzente {
    const domainEntity = new ClientCompanyAssignedAkzente();
    domainEntity.id = raw.id;
    if (raw.akzente) {
      domainEntity.akzente = AkzenteMapper.toDomain(raw.akzente);
    }
    if (raw.clientCompany) {
      domainEntity.clientCompany = ClientCompanyMapper.toDomain(raw.clientCompany);
    }
    domainEntity.createdAt = raw.createdAt;
    domainEntity.updatedAt = raw.updatedAt;
    return domainEntity;
  }

  static toPersistence(domainEntity: ClientCompanyAssignedAkzente): ClientCompanyAssignedAkzenteEntity {
    const persistenceEntity = new ClientCompanyAssignedAkzenteEntity();
    if (domainEntity.id) {
      persistenceEntity.id = domainEntity.id;
    }
    if (domainEntity.akzente) {
      persistenceEntity.akzente = AkzenteMapper.toPersistence(domainEntity.akzente);
    }
    if (domainEntity.clientCompany) {
      persistenceEntity.clientCompany = ClientCompanyMapper.toPersistence(domainEntity.clientCompany);
    }
    persistenceEntity.createdAt = domainEntity.createdAt;
    persistenceEntity.updatedAt = domainEntity.updatedAt;
    return persistenceEntity;
  }
}