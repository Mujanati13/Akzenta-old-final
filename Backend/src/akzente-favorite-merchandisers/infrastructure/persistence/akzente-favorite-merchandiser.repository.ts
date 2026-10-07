import { DeepPartial } from '../../../utils/types/deep-partial.type';
import { NullableType } from '../../../utils/types/nullable.type';
import { IPaginationOptions } from '../../../utils/types/pagination-options';
import { AkzenteFavoriteMerchandiser } from '../../domain/akzente-favorite-merchandiser';

export abstract class AkzenteFavoriteMerchandiserRepository {
  abstract create(
    data: Omit<AkzenteFavoriteMerchandiser, 'id' | 'createdAt' | 'updatedAt'>,
  ): Promise<AkzenteFavoriteMerchandiser>;

  abstract findAllWithPagination({
    paginationOptions,
  }: {
    paginationOptions: IPaginationOptions;
  }): Promise<AkzenteFavoriteMerchandiser[]>;

  abstract findById(
    id: AkzenteFavoriteMerchandiser['id'],
  ): Promise<NullableType<AkzenteFavoriteMerchandiser>>;

  abstract findByIds(ids: AkzenteFavoriteMerchandiser['id'][]): Promise<AkzenteFavoriteMerchandiser[]>;

  abstract findByAkzenteId(akzenteId: number): Promise<AkzenteFavoriteMerchandiser[]>;

  abstract update(
    id: AkzenteFavoriteMerchandiser['id'],
    payload: DeepPartial<AkzenteFavoriteMerchandiser>,
  ): Promise<AkzenteFavoriteMerchandiser | null>;

  abstract remove(id: AkzenteFavoriteMerchandiser['id']): Promise<void>;
}
