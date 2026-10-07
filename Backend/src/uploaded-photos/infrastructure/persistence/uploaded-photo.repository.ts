import { DeepPartial } from '../../../utils/types/deep-partial.type';
import { NullableType } from '../../../utils/types/nullable.type';
import { IPaginationOptions } from '../../../utils/types/pagination-options';
import { UploadedPhoto } from '../../domain/uploaded-photo';

export abstract class UploadedPhotoRepository {
  abstract create(
    data: Omit<UploadedPhoto, 'id' | 'createdAt' | 'updatedAt'>,
  ): Promise<UploadedPhoto>;

  abstract findAllWithPagination({
    paginationOptions,
  }: {
    paginationOptions: IPaginationOptions;
  }): Promise<{ data: UploadedPhoto[]; totalCount: number }>;

  abstract findById(
    id: UploadedPhoto['id'],
  ): Promise<NullableType<UploadedPhoto>>;

  abstract findByIds(ids: UploadedPhoto['id'][]): Promise<UploadedPhoto[]>;

  abstract update(
    id: UploadedPhoto['id'],
    payload: DeepPartial<UploadedPhoto>,
  ): Promise<UploadedPhoto | null>;

  abstract remove(id: UploadedPhoto['id']): Promise<void>;
}
