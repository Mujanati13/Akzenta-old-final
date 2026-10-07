import { AnswerTypeMapper } from '../../../../../answer-type/infrastructure/persistence/relational/mappers/answer-type.mapper';
import { ProjectMapper } from '../../../../../project/infrastructure/persistence/relational/mappers/project.mapper';
import { Question } from '../../../../domain/question';
import { QuestionEntity } from '../entities/question.entity';
import { QuestionOptionMapper } from '../../../../../question-option/infrastructure/persistence/relational/mappers/question-option.mapper';

export class QuestionMapper {
  static toDomain(raw: QuestionEntity): Question {
    const domainEntity = new Question();
    domainEntity.id = raw.id;
    if (raw.project) {
      domainEntity.project = ProjectMapper.toDomain(raw.project);
    }
    if (raw.answerType) {
      domainEntity.answerType = AnswerTypeMapper.toDomain(raw.answerType);
    }
    domainEntity.questionText = raw.questionText;
    domainEntity.isRequired = raw.isRequired;
    domainEntity.isVisibleToClient = raw.isVisibleToClient;
    domainEntity.showInOverview = raw.showInOverview;
    if (raw.options) {
      domainEntity.options = raw.options.map(option => QuestionOptionMapper.toDomain(option));
    }
    domainEntity.createdAt = raw.createdAt;
    domainEntity.updatedAt = raw.updatedAt;

    return domainEntity;
  }

  static toPersistence(domainEntity: Question): QuestionEntity {
    const persistenceEntity = new QuestionEntity();
    if (domainEntity.id) {
      persistenceEntity.id = domainEntity.id;
    }
    if (domainEntity.project) {
      persistenceEntity.project = ProjectMapper.toPersistence(domainEntity.project);
    }
    if (domainEntity.answerType) {
      persistenceEntity.answerType = AnswerTypeMapper.toPersistence(domainEntity.answerType);
    }
    persistenceEntity.questionText = domainEntity.questionText;
    persistenceEntity.isRequired = domainEntity.isRequired;
    persistenceEntity.isVisibleToClient = domainEntity.isVisibleToClient;
    persistenceEntity.showInOverview = domainEntity.showInOverview;
    if (domainEntity.options) {
      persistenceEntity.options = domainEntity.options.map(option => QuestionOptionMapper.toPersistence(option));
    }
    persistenceEntity.createdAt = domainEntity.createdAt;
    persistenceEntity.updatedAt = domainEntity.updatedAt;

    return persistenceEntity;
  }
}