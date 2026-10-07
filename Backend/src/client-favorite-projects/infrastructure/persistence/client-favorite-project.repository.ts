import { DeepPartial } from '../../../utils/types/deep-partial.type';
import { NullableType } from '../../../utils/types/nullable.type';
import { IPaginationOptions } from '../../../utils/types/pagination-options';
import { ClientFavoriteProject } from '../../domain/client-favorite-project';

export abstract class ClientFavoriteProjectRepository {
  abstract create(
    data: Omit<ClientFavoriteProject, 'id' | 'createdAt' | 'updatedAt'>,
  ): Promise<ClientFavoriteProject>;

  abstract findAllWithPagination({
    paginationOptions,
  }: {
    paginationOptions: IPaginationOptions;
  }): Promise<ClientFavoriteProject[]>;

  abstract findById(
    id: ClientFavoriteProject['id'],
  ): Promise<NullableType<ClientFavoriteProject>>;

  abstract findByIds(ids: ClientFavoriteProject['id'][]): Promise<ClientFavoriteProject[]>;

  abstract findOne(options: { clientId: number; projectId: number }): Promise<NullableType<ClientFavoriteProject>>;

  abstract findByClientId(clientId: number): Promise<ClientFavoriteProject[]>;

  abstract update(
    id: ClientFavoriteProject['id'],
    payload: DeepPartial<ClientFavoriteProject>,
  ): Promise<ClientFavoriteProject | null>;

  abstract remove(id: ClientFavoriteProject['id']): Promise<void>;
}
