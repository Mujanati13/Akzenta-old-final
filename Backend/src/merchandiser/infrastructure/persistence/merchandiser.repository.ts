import { DeepPartial } from '../../../utils/types/deep-partial.type';
import { NullableType } from '../../../utils/types/nullable.type';
import { IPaginationOptions } from '../../../utils/types/pagination-options';
import { Merchandiser } from '../../domain/merchandiser';
import { FilterMerchandiserDto, SortMerchandiserDto } from '../../dto/query-merchandiser.dto';

export abstract class MerchandiserRepository {
  abstract create(
    data: Omit<Merchandiser, 'id' | 'createdAt' | 'updatedAt'>,
  ): Promise<Merchandiser>;

  abstract findAllWithPagination({
    paginationOptions,
    filters,
    sort,
  }: {
    paginationOptions: IPaginationOptions;
    filters?: FilterMerchandiserDto | null;
    sort?: SortMerchandiserDto[] | null;
  }): Promise<{ data: Merchandiser[]; totalCount: number }>;

  abstract findById(
    id: Merchandiser['id'],
  ): Promise<NullableType<Merchandiser>>;

  abstract findByIds(ids: Merchandiser['id'][]): Promise<Merchandiser[]>;

  abstract findByUserId(userId: number): Promise<NullableType<Merchandiser>>;

  abstract findByFullName(fullName: string): Promise<Merchandiser | null>;

  abstract update(
    id: Merchandiser['id'],
    payload: DeepPartial<Merchandiser>,
  ): Promise<Merchandiser | null>;

  abstract remove(id: Merchandiser['id']): Promise<void>;
}
