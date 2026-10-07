import { DeepPartial } from '../../../utils/types/deep-partial.type';
import { NullableType } from '../../../utils/types/nullable.type';
import { IPaginationOptions } from '../../../utils/types/pagination-options';
import { AkzenteFavoriteClient } from '../../domain/akzente-favorite-client';

export abstract class AkzenteFavoriteClientRepository {
  abstract create(
    data: Omit<AkzenteFavoriteClient, 'id' | 'createdAt' | 'updatedAt'>,
  ): Promise<AkzenteFavoriteClient>;

  abstract findAllWithPagination({
    paginationOptions,
  }: {
    paginationOptions: IPaginationOptions;
  }): Promise<AkzenteFavoriteClient[]>;

  abstract findById(
    id: AkzenteFavoriteClient['id'],
  ): Promise<NullableType<AkzenteFavoriteClient>>;

  abstract findByIds(ids: AkzenteFavoriteClient['id'][]): Promise<AkzenteFavoriteClient[]>;

  abstract update(
    id: AkzenteFavoriteClient['id'],
    payload: DeepPartial<AkzenteFavoriteClient>,
  ): Promise<AkzenteFavoriteClient | null>;

  abstract remove(id: AkzenteFavoriteClient['id']): Promise<void>;
}
