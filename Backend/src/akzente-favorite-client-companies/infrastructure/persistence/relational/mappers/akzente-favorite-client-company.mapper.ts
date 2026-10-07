import { AkzenteFavoriteClientCompany } from '../../../../domain/akzente-favorite-client-company';
import { AkzenteFavoriteClientCompanyEntity } from '../entities/akzente-favorite-client-company.entity';
import { AkzenteMapper } from '../../../../../akzente/infrastructure/persistence/relational/mappers/akzente.mapper';
import { ClientCompanyMapper } from '../../../../../client-company/infrastructure/persistence/relational/mappers/client-company.mapper';

export class AkzenteFavoriteClientCompanyMapper {
  static toDomain(raw: AkzenteFavoriteClientCompanyEntity): AkzenteFavoriteClientCompany {
    const domainEntity = new AkzenteFavoriteClientCompany();
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

  static toPersistence(
    domainEntity: AkzenteFavoriteClientCompany,
  ): AkzenteFavoriteClientCompanyEntity {
    const persistenceEntity = new AkzenteFavoriteClientCompanyEntity();
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
