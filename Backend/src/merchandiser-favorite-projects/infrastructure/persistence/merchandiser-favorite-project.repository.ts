import { DeepPartial } from '../../../utils/types/deep-partial.type';
import { NullableType } from '../../../utils/types/nullable.type';
import { IPaginationOptions } from '../../../utils/types/pagination-options';
import { MerchandiserFavoriteProject } from '../../domain/merchandiser-favorite-project';

export abstract class MerchandiserFavoriteProjectRepository {
  abstract create(
    data: Omit<MerchandiserFavoriteProject, 'id' | 'createdAt' | 'updatedAt'>,
  ): Promise<MerchandiserFavoriteProject>;

  abstract findAllWithPagination({
    paginationOptions,
  }: {
    paginationOptions: IPaginationOptions;
  }): Promise<MerchandiserFavoriteProject[]>;

  abstract findById(
    id: MerchandiserFavoriteProject['id'],
  ): Promise<NullableType<MerchandiserFavoriteProject>>;

  abstract findByIds(ids: MerchandiserFavoriteProject['id'][]): Promise<MerchandiserFavoriteProject[]>;

  abstract findOne(options: { merchandiserId: number; projectId: number }): Promise<NullableType<MerchandiserFavoriteProject>>;

  abstract findByMerchandiserId(merchandiserId: number): Promise<MerchandiserFavoriteProject[]>;

  abstract update(
    id: MerchandiserFavoriteProject['id'],
    payload: DeepPartial<MerchandiserFavoriteProject>,
  ): Promise<MerchandiserFavoriteProject | null>;

  abstract remove(id: MerchandiserFavoriteProject['id']): Promise<void>;
}
