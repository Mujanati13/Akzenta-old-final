import { DeepPartial } from '../../../utils/types/deep-partial.type';
import { NullableType } from '../../../utils/types/nullable.type';
import { IPaginationOptions } from '../../../utils/types/pagination-options';
import { Cities } from '../../domain/cities';

export abstract class CitiesRepository {
  abstract create(
    data: Omit<Cities, 'id' | 'createdAt' | 'updatedAt'>,
  ): Promise<Cities>;

  abstract findAllWithPagination({
    paginationOptions,
  }: {
    paginationOptions: IPaginationOptions;
  }): Promise<{ data: Cities[]; totalCount: number }>;

  abstract findById(id: Cities['id']): Promise<NullableType<Cities>>;

  abstract findByIds(ids: Cities['id'][]): Promise<Cities[]>;
  
  abstract findByCountryId(countryId: number): Promise<Cities[]>;
  
  abstract findByName(name: string): Promise<Cities | null>;

  abstract findByNameIgnoreCase(name: string): Promise<Cities | null>;

  abstract update(
    id: Cities['id'],
    payload: DeepPartial<Cities>,
  ): Promise<Cities | null>;

  abstract remove(id: Cities['id']): Promise<void>;
}