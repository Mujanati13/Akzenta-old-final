import { AnswerType } from '../../../../domain/answer-type';
import { AnswerTypeEntity } from '../entities/answer-type.entity';

export class AnswerTypeMapper {
  static toDomain(raw: AnswerTypeEntity): AnswerType {
    const domainEntity = new AnswerType();
    domainEntity.id = raw.id;
    domainEntity.name = raw.name;

    return domainEntity;
  }

  static toPersistence(domainEntity: AnswerType): AnswerTypeEntity {
    const persistenceEntity = new AnswerTypeEntity();
    if (domainEntity.id) {
      persistenceEntity.id = domainEntity.id;
    }
    persistenceEntity.name = domainEntity.name;

    return persistenceEntity;
  }
}