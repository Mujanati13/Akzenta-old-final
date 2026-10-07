import { DeepPartial } from '../../../utils/types/deep-partial.type';
import { NullableType } from '../../../utils/types/nullable.type';
import { IPaginationOptions } from '../../../utils/types/pagination-options';
import { AdvancedPhoto } from '../../domain/advanced-photo';

export abstract class AdvancedPhotoRepository {
  abstract create(
    data: Omit<AdvancedPhoto, 'id' | 'createdAt' | 'updatedAt'>,
  ): Promise<AdvancedPhoto>;

  abstract findAllWithPagination({
    paginationOptions,
  }: {
    paginationOptions: IPaginationOptions;
  }): Promise<{ data: AdvancedPhoto[]; totalCount: number }>;

  abstract findById(
    id: AdvancedPhoto['id'],
  ): Promise<NullableType<AdvancedPhoto>>;

  abstract findByProjectId(
    projectId: number,
  ): Promise<AdvancedPhoto[]>;

  abstract findByIds(ids: AdvancedPhoto['id'][]): Promise<AdvancedPhoto[]>;

  abstract update(
    id: AdvancedPhoto['id'],
    payload: DeepPartial<AdvancedPhoto>,
  ): Promise<AdvancedPhoto | null>;

  abstract remove(id: AdvancedPhoto['id']): Promise<void>;
}
