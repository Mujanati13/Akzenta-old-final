import { DeepPartial } from '../../../utils/types/deep-partial.type';
import { NullableType } from '../../../utils/types/nullable.type';
import { IPaginationOptions } from '../../../utils/types/pagination-options';
import { ProjectBranch } from '../../domain/project-branch';

export abstract class ProjectBranchRepository {
  abstract create(
    data: Omit<ProjectBranch, 'id' | 'createdAt' | 'updatedAt'>,
  ): Promise<ProjectBranch>;

  abstract findAllWithPagination({
    paginationOptions,
  }: {
    paginationOptions: IPaginationOptions;
  }): Promise<{ data: ProjectBranch[]; totalCount: number }>;

  abstract findById(
    id: ProjectBranch['id'],
  ): Promise<NullableType<ProjectBranch>>;

  abstract findByIds(ids: ProjectBranch['id'][]): Promise<ProjectBranch[]>;

  abstract findByProjectAndBranch(
    projectId: number,
    branchId: number,
  ): Promise<NullableType<ProjectBranch>>;

  abstract update(
    id: ProjectBranch['id'],
    payload: DeepPartial<ProjectBranch>,
  ): Promise<ProjectBranch | null>;

  abstract remove(id: ProjectBranch['id']): Promise<void>;
}
