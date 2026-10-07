import { DeepPartial } from '../../../utils/types/deep-partial.type';
import { NullableType } from '../../../utils/types/nullable.type';
import { IPaginationOptions } from '../../../utils/types/pagination-options';
import { AkzenteFavoriteReport } from '../../domain/akzente-favorite-report';

export abstract class AkzenteFavoriteReportRepository {
  abstract create(
    data: Omit<AkzenteFavoriteReport, 'id' | 'createdAt' | 'updatedAt'>,
  ): Promise<AkzenteFavoriteReport>;

  abstract findAllWithPagination({
    paginationOptions,
  }: {
    paginationOptions: IPaginationOptions;
  }): Promise<AkzenteFavoriteReport[]>;

  abstract findById(
    id: AkzenteFavoriteReport['id'],
  ): Promise<NullableType<AkzenteFavoriteReport>>;

  abstract findByIds(ids: AkzenteFavoriteReport['id'][]): Promise<AkzenteFavoriteReport[]>;

  abstract findOne(options: { akzenteId: number; reportId: number }): Promise<NullableType<AkzenteFavoriteReport>>;

  abstract findByAkzenteId(akzenteId: number): Promise<AkzenteFavoriteReport[]>;
  
  abstract findByAkzenteIdAndReportIds(akzenteId: number, reportIds: number[]): Promise<AkzenteFavoriteReport[]>;

  abstract update(
    id: AkzenteFavoriteReport['id'],
    payload: DeepPartial<AkzenteFavoriteReport>,
  ): Promise<AkzenteFavoriteReport | null>;

  abstract remove(id: AkzenteFavoriteReport['id']): Promise<void>;
}
