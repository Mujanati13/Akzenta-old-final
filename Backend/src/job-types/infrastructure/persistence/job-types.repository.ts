import { DeepPartial } from '../../../utils/types/deep-partial.type';
import { NullableType } from '../../../utils/types/nullable.type';
import { IPaginationOptions } from '../../../utils/types/pagination-options';
import { JobTypes } from '../../domain/job-types';

export abstract class JobTypesRepository {
  abstract create(
    data: Omit<JobTypes, 'id' | 'createdAt' | 'updatedAt'>,
  ): Promise<JobTypes>;

  abstract findAllWithPagination({
    paginationOptions,
  }: {
    paginationOptions: IPaginationOptions;
  }): Promise<{ data: JobTypes[]; totalCount: number }>;

  abstract findById(
    id: JobTypes['id'],
  ): Promise<NullableType<JobTypes>>;

  abstract findByIds(ids: JobTypes['id'][]): Promise<JobTypes[]>;

  abstract update(
    id: JobTypes['id'],
    payload: DeepPartial<JobTypes>,
  ): Promise<JobTypes | null>;

  abstract remove(id: JobTypes['id']): Promise<void>;
}