import { DeepPartial } from '../../../utils/types/deep-partial.type';
import { NullableType } from '../../../utils/types/nullable.type';
import { IPaginationOptions } from '../../../utils/types/pagination-options';
import { Countries } from '../../domain/countries';

export abstract class CountriesRepository {
  abstract create(
    data: Omit<Countries, 'id' | 'createdAt' | 'updatedAt'>,
  ): Promise<Countries>;

  abstract findAllWithPagination({
    paginationOptions,
    i18n,
  }: {
    paginationOptions: IPaginationOptions;
    i18n: string;
  }): Promise<{ data: Countries[]; totalCount: number }>;

  abstract findById(id: Countries['id']): Promise<NullableType<Countries>>;

  abstract findByIds(ids: Countries['id'][]): Promise<Countries[]>;

  abstract findByLocalizedName(name: string): Promise<NullableType<Countries>>;

  abstract update(
    id: Countries['id'],
    payload: DeepPartial<Countries>,
  ): Promise<Countries | null>;

  abstract remove(id: Countries['id']): Promise<void>;
}
