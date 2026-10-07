import { MerchandiserMapper } from '../../../../../merchandiser/infrastructure/persistence/relational/mappers/merchandiser.mapper';
import { ReportMapper } from '../../../../../report/infrastructure/persistence/relational/mappers/report.mapper';
import { MerchandiserFavoriteReports } from '../../../../domain/merchandiser-favorite-reports';
import { MerchandiserFavoriteReportEntity } from '../entities/merchandiser-favorite-report.entity';

export class MerchandiserFavoriteReportMapper {
  static toDomain(raw: MerchandiserFavoriteReportEntity): MerchandiserFavoriteReports {
    const domainEntity = new MerchandiserFavoriteReports();
    domainEntity.id = raw.id;
    domainEntity.report = ReportMapper.toDomain(raw.report);
    domainEntity.merchandiser = MerchandiserMapper.toDomain(raw.merchandiser);
    domainEntity.createdAt = raw.createdAt;
    domainEntity.updatedAt = raw.updatedAt;

    return domainEntity;
  }

  static toPersistence(domainEntity: MerchandiserFavoriteReports): MerchandiserFavoriteReportEntity {
    const persistenceEntity = new MerchandiserFavoriteReportEntity();
    if (domainEntity.id) {
      persistenceEntity.id = domainEntity.id;
    }
    persistenceEntity.report = ReportMapper.toPersistence(domainEntity.report);
    persistenceEntity.merchandiser = MerchandiserMapper.toPersistence(domainEntity.merchandiser);
    persistenceEntity.createdAt = domainEntity.createdAt;
    persistenceEntity.updatedAt = domainEntity.updatedAt;

    return persistenceEntity;
  }
}