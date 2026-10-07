import { DeepPartial } from '../../../utils/types/deep-partial.type';
import { NullableType } from '../../../utils/types/nullable.type';
import { IPaginationOptions } from '../../../utils/types/pagination-options';
import { Akzente } from '../../domain/akzente';

export abstract class AkzenteRepository {
  abstract create(
    data: Omit<Akzente, 'id' | 'createdAt' | 'updatedAt'>,
  ): Promise<Akzente>;

  abstract findAllWithPagination({
    paginationOptions,
  }: {
    paginationOptions: IPaginationOptions;
  }): Promise<{ data: Akzente[]; totalCount: number }>;

  abstract findById(id: Akzente['id']): Promise<NullableType<Akzente>>;

  abstract findByUserId(userId: Akzente['user']['id']): Promise<NullableType<Akzente>>;

  abstract findByIds(ids: Akzente['id'][]): Promise<Akzente[]>;

  abstract update(
    id: Akzente['id'],
    payload: DeepPartial<Akzente>,
  ): Promise<Akzente | null>;

  abstract remove(id: Akzente['id']): Promise<void>;
}
