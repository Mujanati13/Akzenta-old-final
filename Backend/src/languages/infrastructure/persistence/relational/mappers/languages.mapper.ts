import { Languages } from '../../../../domain/languages';
import { LanguagesEntity } from '../entities/languages.entity';

export class LanguagesMapper {
  static toDomain(raw: LanguagesEntity): Languages {
    const domainEntity = new Languages();
    domainEntity.id = raw.id;
    domainEntity.name = raw.name;
    domainEntity.createdAt = raw.createdAt;
    domainEntity.updatedAt = raw.updatedAt;

    return domainEntity;
  }

  static toPersistence(domainEntity: Languages): LanguagesEntity {
    const persistenceEntity = new LanguagesEntity();
    if (domainEntity.id) {
      persistenceEntity.id = domainEntity.id;
    }
    persistenceEntity.name = domainEntity.name;
    persistenceEntity.createdAt = domainEntity.createdAt;
    persistenceEntity.updatedAt = domainEntity.updatedAt;

    return persistenceEntity;
  }
}