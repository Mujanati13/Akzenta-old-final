import { DeepPartial } from '../../../utils/types/deep-partial.type';
import { NullableType } from '../../../utils/types/nullable.type';
import { IPaginationOptions } from '../../../utils/types/pagination-options';
import { AnswerType } from '../../domain/answer-type';

export abstract class AnswerTypeRepository {
  abstract create(
    data: Omit<AnswerType, 'id' | 'createdAt' | 'updatedAt'>,
  ): Promise<AnswerType>;

  abstract findAllWithPagination({
    paginationOptions,
  }: {
    paginationOptions: IPaginationOptions;
  }): Promise<{ data: AnswerType[]; totalCount: number }>;

  abstract findById(
    id: AnswerType['id'],
  ): Promise<NullableType<AnswerType>>;

  abstract update(
    id: AnswerType['id'],
    payload: DeepPartial<AnswerType>,
  ): Promise<AnswerType | null>;

  abstract remove(id: AnswerType['id']): Promise<void>;
}