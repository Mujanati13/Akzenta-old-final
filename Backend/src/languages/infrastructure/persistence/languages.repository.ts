import { DeepPartial } from '../../../utils/types/deep-partial.type';
import { NullableType } from '../../../utils/types/nullable.type';
import { IPaginationOptions } from '../../../utils/types/pagination-options';
import { Languages } from '../../domain/languages';

export abstract class LanguagesRepository {
  abstract create(
    data: Omit<Languages, 'id' | 'createdAt' | 'updatedAt'>,
  ): Promise<Languages>;

  abstract findAllWithPagination({
    paginationOptions,
  }: {
    paginationOptions: IPaginationOptions;
  }): Promise<{ data: Languages[]; totalCount: number }>;

  abstract findById(
    id: Languages['id'],
  ): Promise<NullableType<Languages>>;

  abstract findByIds(ids: Languages['id'][]): Promise<Languages[]>;

  abstract update(
    id: Languages['id'],
    payload: DeepPartial<Languages>,
  ): Promise<Languages | null>;

  abstract remove(id: Languages['id']): Promise<void>;
}