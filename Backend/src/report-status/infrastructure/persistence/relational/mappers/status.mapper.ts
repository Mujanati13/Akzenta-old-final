import { ReportStatus } from '../../../../domain/status';
import { StatusEntity } from '../entities/status.entity';

export class StatusMapper {
  static toDomain(raw: StatusEntity): ReportStatus {
    const domainEntity = new ReportStatus();
    domainEntity.id = raw.id;
    domainEntity.name = raw.name;
    domainEntity.akzenteName = raw.akzenteName;
    domainEntity.clientName = raw.clientName;
    domainEntity.merchandiserName = raw.merchandiserName;
    domainEntity.akzenteColor = raw.akzenteColor;
    domainEntity.clientColor = raw.clientColor;
    domainEntity.merchandiserColor = raw.merchandiserColor;
    return domainEntity;
  }

  static toPersistence(domainEntity: ReportStatus): StatusEntity {
    const persistenceEntity = new StatusEntity();
    if (domainEntity.id) {
      persistenceEntity.id = domainEntity.id;
    }
    persistenceEntity.name = domainEntity.name;
    persistenceEntity.akzenteName = domainEntity.akzenteName;
    persistenceEntity.clientName = domainEntity.clientName;
    persistenceEntity.merchandiserName = domainEntity.merchandiserName;
    persistenceEntity.akzenteColor = domainEntity.akzenteColor;
    persistenceEntity.clientColor = domainEntity.clientColor;
    persistenceEntity.merchandiserColor = domainEntity.merchandiserColor;
    return persistenceEntity;
  }
}
