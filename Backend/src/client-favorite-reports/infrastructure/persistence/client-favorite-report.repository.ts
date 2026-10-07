import { DeepPartial } from '../../../utils/types/deep-partial.type';
import { NullableType } from '../../../utils/types/nullable.type';
import { IPaginationOptions } from '../../../utils/types/pagination-options';
import { ClientFavoriteReport } from '../../domain/client-favorite-report';

export abstract class ClientFavoriteReportRepository {
  abstract create(
    data: Omit<ClientFavoriteReport, 'id' | 'createdAt' | 'updatedAt'>,
  ): Promise<ClientFavoriteReport>;

  abstract findAllWithPagination({
    paginationOptions,
  }: {
    paginationOptions: IPaginationOptions;
  }): Promise<ClientFavoriteReport[]>;

  abstract findById(
    id: ClientFavoriteReport['id'],
  ): Promise<NullableType<ClientFavoriteReport>>;

  abstract findByIds(ids: ClientFavoriteReport['id'][]): Promise<ClientFavoriteReport[]>;

  abstract findOne(options: { clientId: number; reportId: number }): Promise<NullableType<ClientFavoriteReport>>;

  abstract findByClientId(clientId: number): Promise<ClientFavoriteReport[]>;

  abstract findByClientIdAndReportIds(clientId: number, reportIds: number[]): Promise<ClientFavoriteReport[]>;

  abstract update(
    id: ClientFavoriteReport['id'],
    payload: DeepPartial<ClientFavoriteReport>,
  ): Promise<ClientFavoriteReport | null>;

  abstract remove(id: ClientFavoriteReport['id']): Promise<void>;
}
