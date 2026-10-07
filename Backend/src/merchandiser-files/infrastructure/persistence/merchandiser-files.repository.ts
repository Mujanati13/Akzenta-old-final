import { DeepPartial } from '../../../utils/types/deep-partial.type';
import { NullableType } from '../../../utils/types/nullable.type';
import { IPaginationOptions } from '../../../utils/types/pagination-options';
import { MerchandiserFiles, MerchandiserFileType } from '../../domain/merchandiser-files';

export abstract class MerchandiserFilesRepository {
  abstract create(
    data: Omit<MerchandiserFiles, 'id' | 'createdAt' | 'updatedAt'>,
  ): Promise<MerchandiserFiles>;

  abstract findAllWithPagination({
    paginationOptions,
  }: {
    paginationOptions: IPaginationOptions;
  }): Promise<{ data: MerchandiserFiles[]; totalCount: number }>;

  abstract findById(
    id: MerchandiserFiles['id'],
  ): Promise<NullableType<MerchandiserFiles>>;

  abstract findByMerchandiserId(
    merchandiserId: number,
  ): Promise<MerchandiserFiles[]>;

  abstract findByMerchandiserIdAndType(
    merchandiserId: number,
    type: MerchandiserFileType,
  ): Promise<MerchandiserFiles[]>;

  abstract findByType(
    type: MerchandiserFileType,
  ): Promise<MerchandiserFiles[]>;

  abstract findByMerchandiserIdsAndType(
    merchandiserIds: number[],
    type: MerchandiserFileType,
  ): Promise<MerchandiserFiles[]>;

  abstract update(
    id: MerchandiserFiles['id'],
    payload: DeepPartial<MerchandiserFiles>,
  ): Promise<MerchandiserFiles | null>;

  abstract remove(id: MerchandiserFiles['id']): Promise<void>;
}