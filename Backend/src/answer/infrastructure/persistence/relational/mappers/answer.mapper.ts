import { QuestionOptionMapper } from '../../../../../question-option/infrastructure/persistence/relational/mappers/question-option.mapper';
import { QuestionMapper } from '../../../../../question/infrastructure/persistence/relational/mappers/question.mapper';
import { ReportMapper } from '../../../../../report/infrastructure/persistence/relational/mappers/report.mapper';
import { Answer } from '../../../../domain/answer';
import { AnswerEntity } from '../entities/answer.entity';

export class AnswerMapper {
  static toDomain(raw: AnswerEntity): Answer {
    const domainEntity = new Answer();
    domainEntity.id = raw.id;
    if (raw.question) {
      domainEntity.question = QuestionMapper.toDomain(raw.question);
    }
    domainEntity.selectedOption = raw.selectedOption
      ? QuestionOptionMapper.toDomain(raw.selectedOption)
      : null;
    domainEntity.textAnswer = raw.textAnswer;
    if (raw.report) {
      domainEntity.report = ReportMapper.toDomain(raw.report);
    }
    domainEntity.createdAt = raw.createdAt;
    domainEntity.updatedAt = raw.updatedAt;

    return domainEntity;
  }

  static toPersistence(domainEntity: Answer): AnswerEntity {
    const persistenceEntity = new AnswerEntity();
    if (domainEntity.id) {
      persistenceEntity.id = domainEntity.id;
    }
    if (domainEntity.question) {
      persistenceEntity.question = QuestionMapper.toPersistence(domainEntity.question);
    }
    persistenceEntity.selectedOption = domainEntity.selectedOption
      ? QuestionOptionMapper.toPersistence(domainEntity.selectedOption)
      : null;
    persistenceEntity.textAnswer = domainEntity.textAnswer ?? null;
    if (domainEntity.report) {
      persistenceEntity.report = ReportMapper.toPersistence(domainEntity.report);
    }
    persistenceEntity.createdAt = domainEntity.createdAt;
    persistenceEntity.updatedAt = domainEntity.updatedAt;

    return persistenceEntity;
  }
}