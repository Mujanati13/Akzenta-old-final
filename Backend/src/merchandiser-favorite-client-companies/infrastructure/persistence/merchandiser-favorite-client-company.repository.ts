import { DeepPartial } from '../../../utils/types/deep-partial.type';
import { NullableType } from '../../../utils/types/nullable.type';
import { IPaginationOptions } from '../../../utils/types/pagination-options';
import { MerchandiserFavoriteClientCompany } from '../../domain/merchandiser-favorite-client-company';

export abstract class MerchandiserFavoriteClientCompanyRepository {
  abstract create(
    data: Omit<MerchandiserFavoriteClientCompany, 'id' | 'createdAt' | 'updatedAt'>,
  ): Promise<MerchandiserFavoriteClientCompany>;

  abstract findAllWithPagination({
    paginationOptions,
  }: {
    paginationOptions: IPaginationOptions;
  }): Promise<{ data: MerchandiserFavoriteClientCompany[]; totalCount: number }>;

  abstract findById(
    id: MerchandiserFavoriteClientCompany['id'],
  ): Promise<NullableType<MerchandiserFavoriteClientCompany>>;

  abstract findByIds(ids: MerchandiserFavoriteClientCompany['id'][]): Promise<MerchandiserFavoriteClientCompany[]>;

  abstract findOne(options: { merchandiserId: number; clientCompanyId: number }): Promise<NullableType<MerchandiserFavoriteClientCompany>>;

  abstract findByMerchandiserId(merchandiserId: number): Promise<MerchandiserFavoriteClientCompany[]>;

  abstract update(
    id: MerchandiserFavoriteClientCompany['id'],
    payload: Partial<MerchandiserFavoriteClientCompany>,
  ): Promise<MerchandiserFavoriteClientCompany | null>;

  abstract remove(id: MerchandiserFavoriteClientCompany['id']): Promise<void>;
}
