import { DeepPartial } from '../../../utils/types/deep-partial.type';
import { NullableType } from '../../../utils/types/nullable.type';
import { IPaginationOptions } from '../../../utils/types/pagination-options';
import { ClientCompanyAssignedAkzente } from '../../domain/client-company-assigned-akzente';

export abstract class ClientCompanyAssignedAkzenteRepository {  
  abstract create(
    data: Omit<ClientCompanyAssignedAkzente, 'id' | 'createdAt' | 'updatedAt'>,
  ): Promise<ClientCompanyAssignedAkzente>;

  abstract findAllWithPagination({
    paginationOptions,
  }: {
    paginationOptions: IPaginationOptions;
  }): Promise<{ data: ClientCompanyAssignedAkzente[]; totalCount: number }>;

  abstract findById(id: ClientCompanyAssignedAkzente['id']): Promise<NullableType<ClientCompanyAssignedAkzente>>;

  abstract findByIds(ids: ClientCompanyAssignedAkzente['id'][]): Promise<ClientCompanyAssignedAkzente[]>;

  abstract findByAkzenteId(akzenteId: number): Promise<ClientCompanyAssignedAkzente[]>;
  abstract findByAkzenteIdWithPagination(akzenteId: number, paginationOptions: IPaginationOptions): Promise<{ data: ClientCompanyAssignedAkzente[]; totalCount: number }>;

  abstract findByClientCompanyId(clientCompanyId: number): Promise<ClientCompanyAssignedAkzente[]>;

  abstract update(
    id: ClientCompanyAssignedAkzente['id'],
    payload: Partial<ClientCompanyAssignedAkzente>,
  ): Promise<ClientCompanyAssignedAkzente | null>;

  abstract remove(id: ClientCompanyAssignedAkzente['id']): Promise<void>;
}