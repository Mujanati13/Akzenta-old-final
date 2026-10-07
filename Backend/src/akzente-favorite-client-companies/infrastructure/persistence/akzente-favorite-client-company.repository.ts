import { DeepPartial } from '../../../utils/types/deep-partial.type';
import { NullableType } from '../../../utils/types/nullable.type';
import { IPaginationOptions } from '../../../utils/types/pagination-options';
import { AkzenteFavoriteClientCompany } from '../../domain/akzente-favorite-client-company';

export abstract class AkzenteFavoriteClientCompanyRepository {
  abstract create(
    data: Omit<AkzenteFavoriteClientCompany, 'id' | 'createdAt' | 'updatedAt'>,
  ): Promise<AkzenteFavoriteClientCompany>;

  abstract findAllWithPagination({
    paginationOptions,
  }: {
    paginationOptions: IPaginationOptions;
  }): Promise<{ data: AkzenteFavoriteClientCompany[]; totalCount: number }>;

  abstract findById(
    id: AkzenteFavoriteClientCompany['id'],
  ): Promise<NullableType<AkzenteFavoriteClientCompany>>;

  abstract findByIds(
    ids: AkzenteFavoriteClientCompany['id'][],
  ): Promise<AkzenteFavoriteClientCompany[]>;

  abstract findByAkzenteId(akzenteId: number): Promise<AkzenteFavoriteClientCompany[]>;

  abstract update(
    id: AkzenteFavoriteClientCompany['id'],
    payload: Partial<AkzenteFavoriteClientCompany>,
  ): Promise<AkzenteFavoriteClientCompany | null>;

  abstract remove(id: AkzenteFavoriteClientCompany['id']): Promise<void>;
}
