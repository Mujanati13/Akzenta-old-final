import { Status } from '../../../../domain/status';
import { MerchandiserStatusEntity } from '../entities/status.entity';

export class StatusMapper {
  static toDomain(raw: MerchandiserStatusEntity): Status {
    const domainEntity = new Status();
    domainEntity.id = raw.id;
    domainEntity.name = raw.name;
    return domainEntity;
  }

  static toPersistence(domainEntity: Status): MerchandiserStatusEntity {
    const persistenceEntity = new MerchandiserStatusEntity();
    if (domainEntity.id) {
      persistenceEntity.id = domainEntity.id;
    }
    persistenceEntity.name = domainEntity.name;
    return persistenceEntity;
  }
}
