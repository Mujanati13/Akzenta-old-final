import { DeepPartial } from '../../../utils/types/deep-partial.type';
import { NullableType } from '../../../utils/types/nullable.type';
import { IPaginationOptions } from '../../../utils/types/pagination-options';
import { Specializations } from '../../domain/specializations';

export abstract class SpecializationsRepository {
  abstract create(
    data: Omit<Specializations, 'id' | 'createdAt' | 'updatedAt'>,
  ): Promise<Specializations>;

  abstract findAllWithPagination({
    paginationOptions,
  }: {
    paginationOptions: IPaginationOptions;
  }): Promise<{ data: Specializations[]; totalCount: number }>;

  abstract findById(
    id: Specializations['id'],
  ): Promise<NullableType<Specializations>>;

  abstract findByIds(ids: Specializations['id'][]): Promise<Specializations[]>;

  abstract findByJobTypeId(jobTypeId: number): Promise<Specializations[]>;

  abstract update(
    id: Specializations['id'],
    payload: DeepPartial<Specializations>,
  ): Promise<Specializations | null>;

  abstract remove(id: Specializations['id']): Promise<void>;
}