import { DeepPartial } from '../../../utils/types/deep-partial.type';
import { NullableType } from '../../../utils/types/nullable.type';
import { IPaginationOptions } from '../../../utils/types/pagination-options';
import { Photo } from '../../domain/photo';

export abstract class PhotoRepository {
  abstract create(
    data: Omit<Photo, 'id' | 'createdAt' | 'updatedAt'>,
  ): Promise<Photo>;

  abstract findAllWithPagination({
    paginationOptions,
  }: {
    paginationOptions: IPaginationOptions;
  }): Promise<{ data: Photo[]; totalCount: number }>;

  abstract findById(id: Photo['id']): Promise<NullableType<Photo>>;

  abstract findByIds(ids: Photo['id'][]): Promise<Photo[]>;

  abstract update(
    id: Photo['id'],
    payload: DeepPartial<Photo>,
  ): Promise<Photo | null>;

  abstract remove(id: Photo['id']): Promise<void>;
}
