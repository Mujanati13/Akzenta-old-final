import { DeepPartial } from '../../../utils/types/deep-partial.type';
import { NullableType } from '../../../utils/types/nullable.type';
import { IPaginationOptions } from '../../../utils/types/pagination-options';
import { Branch } from '../../domain/branch';

export abstract class BranchRepository {
  abstract create(
    data: Omit<Branch, 'id' | 'createdAt' | 'updatedAt'>,
  ): Promise<Branch>;

  abstract findAllWithPagination({
    paginationOptions,
  }: {
    paginationOptions: IPaginationOptions;
  }): Promise<{ data: Branch[]; totalCount: number }>;

  abstract findById(id: Branch['id']): Promise<NullableType<Branch>>;

  abstract findByIds(ids: Branch['id'][]): Promise<Branch[]>;

  abstract findByNameAndClient(name: string, clientId: number): Promise<NullableType<Branch>>;

  abstract findByBranchNumberAndClient(
    branchNumber: string,
    clientId: number,
  ): Promise<NullableType<Branch>>;

  abstract findByNameAndBranchNumberAndClient(
    name: string,
    branchNumber: string,
    clientId: number,
  ): Promise<NullableType<Branch>>;

  abstract findByNameStreetZipCodeCityAndProject(
    name: string,
    street: string | null,
    zipCode: string | null,
    cityId: number,
    projectId: number,
  ): Promise<NullableType<Branch>>;

  abstract findByNameStreetZipCodeCityAndClient(
    name: string,
    street: string | null,
    zipCode: string | null,
    cityId: number,
    clientId: number,
  ): Promise<NullableType<Branch>>;

  abstract findByClientCompanyId(clientCompanyId: number): Promise<Branch[]>;

  abstract update(
    id: Branch['id'],
    payload: DeepPartial<Branch>,
  ): Promise<Branch | null>;

  abstract remove(id: Branch['id']): Promise<void>;
}
