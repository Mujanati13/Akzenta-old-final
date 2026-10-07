import { DeepPartial } from '../../../utils/types/deep-partial.type';
import { NullableType } from '../../../utils/types/nullable.type';
import { IPaginationOptions } from '../../../utils/types/pagination-options';
import { QuestionOption } from '../../domain/question-option';

export abstract class QuestionOptionRepository {
  abstract create(
    data: Omit<QuestionOption, 'id' | 'createdAt' | 'updatedAt'>,
  ): Promise<QuestionOption>;

  abstract findAllWithPagination({
    paginationOptions,
  }: {
    paginationOptions: IPaginationOptions;
  }): Promise<{ data: QuestionOption[]; totalCount: number }>;

  abstract findById(
    id: QuestionOption['id'],
  ): Promise<NullableType<QuestionOption>>;

  abstract findByQuestionId(
    questionId: number,
  ): Promise<QuestionOption[]>;

  abstract update(
    id: QuestionOption['id'],
    payload: DeepPartial<QuestionOption>,
  ): Promise<QuestionOption | null>;

  abstract remove(id: QuestionOption['id']): Promise<void>;
}