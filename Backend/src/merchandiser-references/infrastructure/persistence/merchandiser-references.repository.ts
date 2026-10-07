import { DeepPartial } from '../../../utils/types/deep-partial.type';
import { NullableType } from '../../../utils/types/nullable.type';
import { IPaginationOptions } from '../../../utils/types/pagination-options';
import { MerchandiserReferences } from '../../domain/merchandiser-references';

export abstract class MerchandiserReferencesRepository {
  abstract create(
    data: Omit<MerchandiserReferences, 'id' | 'createdAt' | 'updatedAt'>,
  ): Promise<MerchandiserReferences>;

  abstract findAllWithPagination({
    paginationOptions,
  }: {
    paginationOptions: IPaginationOptions;
  }): Promise<{ data: MerchandiserReferences[]; totalCount: number }>;

  abstract findById(
    id: MerchandiserReferences['id'],
  ): Promise<NullableType<MerchandiserReferences>>;

  abstract findByMerchandiserId(
    merchandiserId: number,
  ): Promise<MerchandiserReferences[]>;

  abstract update(
    id: MerchandiserReferences['id'],
    payload: DeepPartial<MerchandiserReferences>,
  ): Promise<MerchandiserReferences | null>;

  abstract remove(id: MerchandiserReferences['id']): Promise<void>;
}