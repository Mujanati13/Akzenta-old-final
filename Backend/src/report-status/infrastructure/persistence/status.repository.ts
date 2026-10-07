import { DeepPartial } from '../../../utils/types/deep-partial.type';
import { NullableType } from '../../../utils/types/nullable.type';
import { IPaginationOptions } from '../../../utils/types/pagination-options';
import { ReportStatus } from '../../domain/status';

export abstract class StatusRepository {
  abstract create(
    data: Omit<ReportStatus, 'id' | 'createdAt' | 'updatedAt'>,
  ): Promise<ReportStatus>;

  abstract findAllWithPagination({
    paginationOptions,
  }: {
    paginationOptions: IPaginationOptions;
  }): Promise<{ data: ReportStatus[]; totalCount: number }>;

  abstract findById(id: ReportStatus['id']): Promise<NullableType<ReportStatus>>;

  abstract findByIds(ids: ReportStatus['id'][]): Promise<ReportStatus[]>;

  abstract update(
    id: ReportStatus['id'],
    payload: DeepPartial<ReportStatus>,
  ): Promise<ReportStatus | null>;

  abstract remove(id: ReportStatus['id']): Promise<void>;
}
