import { DeepPartial } from '../../../utils/types/deep-partial.type';
import { NullableType } from '../../../utils/types/nullable.type';
import { IPaginationOptions } from '../../../utils/types/pagination-options';
import { Report } from '../../domain/report';

export abstract class ReportRepository {
  abstract create(
    data: Omit<Report, 'id' | 'createdAt' | 'updatedAt'>,
  ): Promise<Report>;

  abstract findAllWithPagination({
    paginationOptions,
  }: {
    paginationOptions: IPaginationOptions;
  }): Promise<{ data: Report[]; totalCount: number }>;

  abstract findById(id: Report['id']): Promise<NullableType<Report>>;

  abstract findByIdForUpdate(id: Report['id']): Promise<NullableType<Report>>;

  abstract findByIdWithFilteredConversation(
    id: Report['id'],
    viewer: { role: 'akzente' | 'client' | 'merchandiser'; userId: number },
  ): Promise<NullableType<Report>>;

  abstract findByIds(ids: Report['id'][]): Promise<Report[]>;

  abstract update(
    id: Report['id'],
    payload: DeepPartial<Report>,
  ): Promise<Report | null>;

  abstract remove(id: Report['id']): Promise<void>;

  abstract findBranchesByProjectId(projectId: number): Promise<{ branchId: number }[]>;

  abstract findByProjectId(projectId: number): Promise<Report[]>;

  abstract findByProjectIdWithDetails(projectId: number): Promise<Report[]>;

  abstract findByProjectIdsAndStatus(projectIds: number[], status: number): Promise<Report[]>;
  abstract findByProjectIdsAndStatuses(projectIds: number[], statuses: number[]): Promise<Report[]>;

  abstract findByProjectIds(projectIds: number[]): Promise<Report[]>;

  abstract findByBranchId(branchId: number): Promise<Report[]>;

  abstract findByMerchandiserId(merchandiserId: number): Promise<Report[]>;

  abstract findDashboardReportsByMerchandiserId(merchandiserId: number): Promise<Report[]>;

  abstract getReportCountsByStatusForProjects(projectIds: number[]): Promise<{ projectId: number; statusId: number; count: number }[]>;

  abstract getBranchCountsForProjects(projectIds: number[]): Promise<{ projectId: number; count: number }[]>;

  abstract getCompletedBranchCountsForProjects(projectIds: number[]): Promise<{ projectId: number; count: number }[]>;
}
