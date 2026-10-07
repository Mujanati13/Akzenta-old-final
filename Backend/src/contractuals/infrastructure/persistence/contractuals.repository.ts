import { DeepPartial } from '../../../utils/types/deep-partial.type';
import { NullableType } from '../../../utils/types/nullable.type';
import { IPaginationOptions } from '../../../utils/types/pagination-options';
import { Contractuals } from '../../domain/contractuals';

export abstract class ContractualsRepository {
  abstract create(
    data: Omit<Contractuals, 'id' | 'createdAt' | 'updatedAt'>,
  ): Promise<Contractuals>;

  abstract findAllWithPagination({
    paginationOptions,
  }: {
    paginationOptions: IPaginationOptions;
  }): Promise<{ data: Contractuals[]; totalCount: number }>;

  abstract findById(
    id: Contractuals['id'],
  ): Promise<NullableType<Contractuals>>;

  abstract findByIds(ids: Contractuals['id'][]): Promise<Contractuals[]>;

  abstract update(
    id: Contractuals['id'],
    payload: DeepPartial<Contractuals>,
  ): Promise<Contractuals | null>;

  abstract remove(id: Contractuals['id']): Promise<void>;
}