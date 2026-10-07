import { DeepPartial } from '../../../utils/types/deep-partial.type';
import { NullableType } from '../../../utils/types/nullable.type';
import { IPaginationOptions } from '../../../utils/types/pagination-options';
import { MerchandiserJobTypes } from '../../domain/merchandiser-job-types';

export abstract class MerchandiserJobTypesRepository {
  abstract create(
    data: Omit<MerchandiserJobTypes, 'id' | 'createdAt' | 'updatedAt'>,
  ): Promise<MerchandiserJobTypes>;

  abstract findAllWithPagination({
    paginationOptions,
  }: {
    paginationOptions: IPaginationOptions;
  }): Promise<{ data: MerchandiserJobTypes[]; totalCount: number }>;

  abstract findById(
    id: MerchandiserJobTypes['id'],
  ): Promise<NullableType<MerchandiserJobTypes>>;

  abstract findByMerchandiserId(
    merchandiserId: number,
  ): Promise<MerchandiserJobTypes[]>;

  abstract update(
    id: MerchandiserJobTypes['id'],
    payload: DeepPartial<MerchandiserJobTypes>,
  ): Promise<MerchandiserJobTypes | null>;

  abstract remove(id: MerchandiserJobTypes['id']): Promise<void>;
}