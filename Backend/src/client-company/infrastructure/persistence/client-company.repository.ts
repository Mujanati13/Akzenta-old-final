import { DeepPartial } from '../../../utils/types/deep-partial.type';
import { NullableType } from '../../../utils/types/nullable.type';
import { IPaginationOptions } from '../../../utils/types/pagination-options';
import { ClientCompany } from '../../domain/client-company';

export abstract class ClientCompanyRepository {
  abstract create(
    data: Omit<ClientCompany, 'id' | 'createdAt' | 'updatedAt'>,
  ): Promise<ClientCompany>;

  abstract findAllWithPagination({
    paginationOptions,
  }: {
    paginationOptions: IPaginationOptions;
  }): Promise<{ data: ClientCompany[]; totalCount: number }>;

  abstract findById(
    id: ClientCompany['id'],
  ): Promise<NullableType<ClientCompany>>;

  abstract findByIds(ids: ClientCompany['id'][]): Promise<ClientCompany[]>;

  abstract findByNormalizedName(
    name: string,
  ): Promise<NullableType<ClientCompany>>;

  abstract update(
    id: ClientCompany['id'],
    payload: DeepPartial<ClientCompany>,
  ): Promise<ClientCompany | null>;

  abstract remove(id: ClientCompany['id']): Promise<void>;
}
