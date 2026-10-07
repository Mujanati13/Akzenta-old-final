import { Cities } from '../../../../domain/cities';
import { CountriesMapper } from '../../../../../countries/infrastructure/persistence/relational/mappers/countries.mapper';
import { CitiesEntity } from '../entities/cities.entity';

export class CitiesMapper {
  static toDomain(raw: CitiesEntity): Cities {
    const domainEntity = new Cities();

    domainEntity.id = raw.id;
    if (raw.country) {
      domainEntity.country = CountriesMapper.toDomain(raw.country);
    }
    domainEntity.name = raw.name;
    domainEntity.coordinates = raw.coordinates;
    domainEntity.createdAt = raw.createdAt;
    domainEntity.updatedAt = raw.updatedAt;

    return domainEntity;
  }

  static toPersistence(domainEntity: Cities): CitiesEntity {
    const persistenceEntity = new CitiesEntity();
    if (domainEntity.id) {
      persistenceEntity.id = domainEntity.id;
    }
    persistenceEntity.name = domainEntity.name;
    if (domainEntity.country) {
      persistenceEntity.country = CountriesMapper.toPersistence(
        domainEntity.country,
      );
    }
    persistenceEntity.coordinates = domainEntity.coordinates;
    persistenceEntity.createdAt = domainEntity.createdAt;
    persistenceEntity.updatedAt = domainEntity.updatedAt;

    return persistenceEntity;
  }
}