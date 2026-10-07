import { DeepPartial } from '../../../utils/types/deep-partial.type';
import { NullableType } from '../../../utils/types/nullable.type';
import { IPaginationOptions } from '../../../utils/types/pagination-options';
import { MerchandiserEducation } from '../../domain/merchandiser-education';

export abstract class MerchandiserEducationRepository {
  abstract create(
    data: Omit<MerchandiserEducation, 'id' | 'createdAt' | 'updatedAt'>,
  ): Promise<MerchandiserEducation>;

  abstract findAllWithPagination({
    paginationOptions,
  }: {
    paginationOptions: IPaginationOptions;
  }): Promise<{ data: MerchandiserEducation[]; totalCount: number }>;

  abstract findById(
    id: MerchandiserEducation['id'],
  ): Promise<NullableType<MerchandiserEducation>>;

  abstract findByMerchandiserId(
    merchandiserId: number,
  ): Promise<MerchandiserEducation[]>;

  abstract update(
    id: MerchandiserEducation['id'],
    payload: DeepPartial<MerchandiserEducation>,
  ): Promise<MerchandiserEducation | null>;

  abstract remove(id: MerchandiserEducation['id']): Promise<void>;
}