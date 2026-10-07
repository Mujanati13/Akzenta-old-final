import { DeepPartial } from '../../../utils/types/deep-partial.type';
import { NullableType } from '../../../utils/types/nullable.type';
import { IPaginationOptions } from '../../../utils/types/pagination-options';
import { MerchandiserLanguages } from '../../domain/merchandiser-languages';

export abstract class MerchandiserLanguagesRepository {
  abstract create(
    data: Omit<MerchandiserLanguages, 'id' | 'createdAt' | 'updatedAt'>,
  ): Promise<MerchandiserLanguages>;

  abstract findAllWithPagination({
    paginationOptions,
  }: {
    paginationOptions: IPaginationOptions;
  }): Promise<{ data: MerchandiserLanguages[]; totalCount: number }>;

  abstract findById(
    id: MerchandiserLanguages['id'],
  ): Promise<NullableType<MerchandiserLanguages>>;

  abstract findByMerchandiserId(
    merchandiserId: number,
  ): Promise<MerchandiserLanguages[]>;

  abstract update(
    id: MerchandiserLanguages['id'],
    payload: DeepPartial<MerchandiserLanguages>,
  ): Promise<MerchandiserLanguages | null>;

  abstract remove(id: MerchandiserLanguages['id']): Promise<void>;
}