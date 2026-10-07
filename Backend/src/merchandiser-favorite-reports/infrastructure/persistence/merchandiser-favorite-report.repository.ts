import { NullableType } from '../../../utils/types/nullable.type';
import { IPaginationOptions } from '../../../utils/types/pagination-options';
import { MerchandiserFavoriteReports } from '../../domain/merchandiser-favorite-reports';

export abstract class MerchandiserFavoriteReportRepository {
  abstract create(
    data: Omit<MerchandiserFavoriteReports, 'id' | 'createdAt' | 'updatedAt'>,
  ): Promise<MerchandiserFavoriteReports>;

  abstract findAllWithPagination({
    paginationOptions,
  }: {
    paginationOptions: IPaginationOptions;
  }): Promise<{ data: MerchandiserFavoriteReports[]; totalCount: number }>;

  abstract findById(
    id: MerchandiserFavoriteReports['id'],
  ): Promise<NullableType<MerchandiserFavoriteReports>>;

  abstract findByMerchandiserId(
    merchandiserId: number,
  ): Promise<MerchandiserFavoriteReports[]>;

  abstract findOne({
    merchandiserId,
    reportId,
  }: {
    merchandiserId: number;
    reportId: number;
  }): Promise<MerchandiserFavoriteReports | null>;

  abstract remove(id: MerchandiserFavoriteReports['id']): Promise<void>;
}