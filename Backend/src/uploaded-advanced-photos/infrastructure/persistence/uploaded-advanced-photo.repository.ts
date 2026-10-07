import { DeepPartial } from '../../../utils/types/deep-partial.type';
import { NullableType } from '../../../utils/types/nullable.type';
import { IPaginationOptions } from '../../../utils/types/pagination-options';
import { UploadedAdvancedPhoto } from '../../domain/uploaded-advanced-photo';

export abstract class UploadedAdvancedPhotoRepository {
  abstract create(
    data: Omit<UploadedAdvancedPhoto, 'id' | 'createdAt' | 'updatedAt'>,
  ): Promise<UploadedAdvancedPhoto>;

  abstract findAllWithPagination({
    paginationOptions,
  }: {
    paginationOptions: IPaginationOptions;
  }): Promise<{ data: UploadedAdvancedPhoto[]; totalCount: number }>;

  abstract findById(
    id: UploadedAdvancedPhoto['id'],
  ): Promise<NullableType<UploadedAdvancedPhoto>>;

  abstract findByFileId(
    fileId: string,
  ): Promise<NullableType<UploadedAdvancedPhoto>>;

  abstract findByIds(
    ids: UploadedAdvancedPhoto['id'][],
  ): Promise<UploadedAdvancedPhoto[]>;

  abstract update(
    id: UploadedAdvancedPhoto['id'],
    payload: DeepPartial<UploadedAdvancedPhoto>,
  ): Promise<UploadedAdvancedPhoto | null>;

  abstract remove(id: UploadedAdvancedPhoto['id']): Promise<void>;
}
