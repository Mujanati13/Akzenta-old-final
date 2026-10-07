import { DeepPartial } from '../../../utils/types/deep-partial.type';
import { NullableType } from '../../../utils/types/nullable.type';
import { IPaginationOptions } from '../../../utils/types/pagination-options';
import { MerchandiserSpecializations } from '../../domain/merchandiser-specializations';

export abstract class MerchandiserSpecializationsRepository {
  abstract create(
    data: Omit<MerchandiserSpecializations, 'id' | 'createdAt' | 'updatedAt'>,
  ): Promise<MerchandiserSpecializations>;

  abstract findAllWithPagination({
    paginationOptions,
  }: {
    paginationOptions: IPaginationOptions;
  }): Promise<{ data: MerchandiserSpecializations[]; totalCount: number }>;

  abstract findById(
    id: MerchandiserSpecializations['id'],
  ): Promise<NullableType<MerchandiserSpecializations>>;

  abstract findByMerchandiserId(
    merchandiserId: number,
  ): Promise<MerchandiserSpecializations[]>;

  abstract update(
    id: MerchandiserSpecializations['id'],
    payload: DeepPartial<MerchandiserSpecializations>,
  ): Promise<MerchandiserSpecializations | null>;

  abstract remove(id: MerchandiserSpecializations['id']): Promise<void>;
}