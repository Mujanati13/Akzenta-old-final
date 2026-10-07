import { DeepPartial } from '../../../utils/types/deep-partial.type';
import { NullableType } from '../../../utils/types/nullable.type';
import { IPaginationOptions } from '../../../utils/types/pagination-options';
import { ClientCompanyAssignedClient } from '../../domain/client-company-assigned-client';

export abstract class ClientCompanyAssignedClientRepository {
  abstract create(
    data: Omit<ClientCompanyAssignedClient, 'id' | 'createdAt' | 'updatedAt'>,
  ): Promise<ClientCompanyAssignedClient>;

  abstract findAllWithPagination({
    paginationOptions,
  }: {
    paginationOptions: IPaginationOptions;
  }): Promise<{ data: ClientCompanyAssignedClient[]; totalCount: number }>;

  abstract findById(id: ClientCompanyAssignedClient['id']): Promise<NullableType<ClientCompanyAssignedClient>>;

  abstract findByIds(ids: ClientCompanyAssignedClient['id'][]): Promise<ClientCompanyAssignedClient[]>;

  abstract findByClientId(clientId: number): Promise<ClientCompanyAssignedClient[]>;

  abstract findByClientCompanyId(clientCompanyId: number): Promise<ClientCompanyAssignedClient[]>;

  abstract update(
    id: ClientCompanyAssignedClient['id'],
    payload: Partial<ClientCompanyAssignedClient>,
  ): Promise<ClientCompanyAssignedClient | null>;

  abstract remove(id: ClientCompanyAssignedClient['id']): Promise<void>;
}