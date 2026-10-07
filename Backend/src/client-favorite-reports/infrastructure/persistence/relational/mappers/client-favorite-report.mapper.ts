import { ClientFavoriteReport } from '../../../../domain/client-favorite-report';
import { ClientFavoriteReportEntity } from '../entities/client-favorite-report.entity';
import { ClientMapper } from '../../../../../client/infrastructure/persistence/relational/mappers/client.mapper';
import { ReportMapper } from '../../../../../report/infrastructure/persistence/relational/mappers/report.mapper';

export class ClientFavoriteReportMapper {
  static toDomain(raw: ClientFavoriteReportEntity): ClientFavoriteReport {
    const domainEntity = new ClientFavoriteReport();
    domainEntity.id = raw.id;
    if (raw.client) {
      domainEntity.client = ClientMapper.toDomain(raw.client);
    }
    if (raw.report) {
      domainEntity.report = ReportMapper.toDomain(raw.report);
    }
    domainEntity.createdAt = raw.createdAt;
    domainEntity.updatedAt = raw.updatedAt;
    return domainEntity;
  }

  static toPersistence(domainEntity: ClientFavoriteReport): ClientFavoriteReportEntity {
    const persistenceEntity = new ClientFavoriteReportEntity();
    if (domainEntity.id) {
      persistenceEntity.id = domainEntity.id;
    }
    if (domainEntity.client) {
      persistenceEntity.client = ClientMapper.toPersistence(domainEntity.client);
    }
    if (domainEntity.report) {
      persistenceEntity.report = ReportMapper.toPersistence(domainEntity.report);
    }
    persistenceEntity.createdAt = domainEntity.createdAt;
    persistenceEntity.updatedAt = domainEntity.updatedAt;
    return persistenceEntity;
  }
}
