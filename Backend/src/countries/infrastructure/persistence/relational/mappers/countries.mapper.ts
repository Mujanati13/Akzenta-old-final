import { CitiesMapper } from '../../../../../cities/infrastructure/persistence/relational/mappers/cities.mapper';
import { Countries } from '../../../../domain/countries';


import { CountriesEntity } from '../entities/countries.entity';

export class CountriesMapper {
  static toDomain(raw: CountriesEntity): Countries {
    const domainEntity = new Countries();
    domainEntity.id = raw.id;
    domainEntity.name = raw.name;
    domainEntity.flag = raw.flag;
    if (raw.cities) {
      domainEntity.cities = raw.cities.map((item) =>
        CitiesMapper.toDomain(item),
      );
    } else if (raw.cities === null) {
      domainEntity.cities = null;
    }
    domainEntity.createdAt = raw.createdAt;
    domainEntity.updatedAt = raw.updatedAt;

    return domainEntity;
  }

  static toPersistence(domainEntity: Countries): CountriesEntity {
    const persistenceEntity = new CountriesEntity();
    if (domainEntity.id) {
      persistenceEntity.id = domainEntity.id;
    }
    persistenceEntity.flag = domainEntity.flag;
    persistenceEntity.name = domainEntity.name;
    if (domainEntity.cities) {
      persistenceEntity.cities = domainEntity.cities.map((item) =>
        CitiesMapper.toPersistence(item),
      );
    } else if (domainEntity.cities === null) {
      persistenceEntity.cities = null;
    }
    persistenceEntity.createdAt = domainEntity.createdAt;
    persistenceEntity.updatedAt = domainEntity.updatedAt;

    return persistenceEntity;
  }
}
