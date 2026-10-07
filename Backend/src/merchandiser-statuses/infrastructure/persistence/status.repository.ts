import { DeepPartial } from '../../../utils/types/deep-partial.type';
import { NullableType } from '../../../utils/types/nullable.type';
import { IPaginationOptions } from '../../../utils/types/pagination-options';
import { Status } from '../../domain/status';

export abstract class StatusRepository {
  abstract create(
    data: Omit<Status, 'id' | 'createdAt' | 'updatedAt'>,
  ): Promise<Status>;

  abstract findAllWithPagination({
    paginationOptions,
  }: {
    paginationOptions: IPaginationOptions;
  }): Promise<{ data: Status[]; totalCount: number }>;

  abstract findById(id: Status['id']): Promise<NullableType<Status>>;

  abstract findByIds(ids: Status['id'][]): Promise<Status[]>;

  abstract update(
    id: Status['id'],
    payload: DeepPartial<Status>,
  ): Promise<Status | null>;

  abstract remove(id: Status['id']): Promise<void>;
}
