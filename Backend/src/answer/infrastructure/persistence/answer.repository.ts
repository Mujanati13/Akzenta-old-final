import { DeepPartial } from '../../../utils/types/deep-partial.type';
import { NullableType } from '../../../utils/types/nullable.type';
import { IPaginationOptions } from '../../../utils/types/pagination-options';
import { Answer } from '../../domain/answer';

export abstract class AnswerRepository {
  abstract create(
    data: Omit<Answer, 'id' | 'createdAt' | 'updatedAt'>,
  ): Promise<Answer>;

  abstract findAllWithPagination({
    paginationOptions,
  }: {
    paginationOptions: IPaginationOptions;
  }): Promise<{ data: Answer[]; totalCount: number }>;

  abstract findById(
    id: Answer['id'],
  ): Promise<NullableType<Answer>>;

  abstract findByQuestionId(
    questionId: number,
  ): Promise<Answer[]>;

  abstract update(
    id: Answer['id'],
    payload: DeepPartial<Answer>,
  ): Promise<Answer | null>;

  abstract remove(id: Answer['id']): Promise<void>;

  abstract deleteByReportId(reportId: number): Promise<void>;
}