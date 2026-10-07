import { AkzenteFavoriteReport } from '../../../../domain/akzente-favorite-report';
import { AkzenteFavoriteReportEntity } from '../entities/akzente-favorite-report.entity';
import { AkzenteMapper } from '../../../../../akzente/infrastructure/persistence/relational/mappers/akzente.mapper';
import { ReportMapper } from '../../../../../report/infrastructure/persistence/relational/mappers/report.mapper';

export class AkzenteFavoriteReportMapper {
  static toDomain(raw: AkzenteFavoriteReportEntity): AkzenteFavoriteReport {
    const domainEntity = new AkzenteFavoriteReport();
    domainEntity.id = raw.id;
    if (raw.akzente) {
      domainEntity.akzente = AkzenteMapper.toDomain(raw.akzente);
    }
    if (raw.report) {
      domainEntity.report = ReportMapper.toDomain(raw.report);
    }
    domainEntity.createdAt = raw.createdAt;
    domainEntity.updatedAt = raw.updatedAt;
    return domainEntity;
  }

  static toPersistence(domainEntity: AkzenteFavoriteReport): AkzenteFavoriteReportEntity {
    const persistenceEntity = new AkzenteFavoriteReportEntity();
    if (domainEntity.id) {
      persistenceEntity.id = domainEntity.id;
    }
    if (domainEntity.akzente) {
      persistenceEntity.akzente = AkzenteMapper.toPersistence(domainEntity.akzente);
    }
    if (domainEntity.report) {
      persistenceEntity.report = ReportMapper.toPersistence(domainEntity.report);
    }
    persistenceEntity.createdAt = domainEntity.createdAt;
    persistenceEntity.updatedAt = domainEntity.updatedAt;
    return persistenceEntity;
  }
}
