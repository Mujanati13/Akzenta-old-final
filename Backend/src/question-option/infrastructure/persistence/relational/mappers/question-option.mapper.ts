import { QuestionMapper } from '../../../../../question/infrastructure/persistence/relational/mappers/question.mapper';
import { QuestionOption } from '../../../../domain/question-option';
import { QuestionOptionEntity } from '../entities/question-option.entity';

export class QuestionOptionMapper {
  static toDomain(raw: QuestionOptionEntity): QuestionOption {
    const domainEntity = new QuestionOption();
    domainEntity.id = raw.id;
    if (raw.question) {
      domainEntity.question = QuestionMapper.toDomain(raw.question);
    }
    domainEntity.optionText = raw.optionText;
    domainEntity.order = raw.order;
    domainEntity.createdAt = raw.createdAt;
    domainEntity.updatedAt = raw.updatedAt;

    return domainEntity;
  }

  static toPersistence(domainEntity: QuestionOption): QuestionOptionEntity {
    const persistenceEntity = new QuestionOptionEntity();
    if (domainEntity.id) {
      persistenceEntity.id = domainEntity.id;
    }
    if (domainEntity.question) {
      persistenceEntity.question = QuestionMapper.toPersistence(domainEntity.question);
    }
    persistenceEntity.optionText = domainEntity.optionText;
    persistenceEntity.order = domainEntity.order;
    persistenceEntity.createdAt = domainEntity.createdAt;
    persistenceEntity.updatedAt = domainEntity.updatedAt;

    return persistenceEntity;
  }
}