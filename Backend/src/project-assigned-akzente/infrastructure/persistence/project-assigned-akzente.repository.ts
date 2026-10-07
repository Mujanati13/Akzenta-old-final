import { DeepPartial } from '../../../utils/types/deep-partial.type';
import { NullableType } from '../../../utils/types/nullable.type';
import { IPaginationOptions } from '../../../utils/types/pagination-options';
import { ProjectAssignedAkzente } from '../../domain/project-assigned-akzente';

export abstract class ProjectAssignedAkzenteRepository {
  abstract create(
    data: Omit<ProjectAssignedAkzente, 'id' | 'createdAt' | 'updatedAt'>,
  ): Promise<ProjectAssignedAkzente>;

  abstract findAllWithPagination({
    paginationOptions,
  }: {
    paginationOptions: IPaginationOptions;
  }): Promise<{ data: ProjectAssignedAkzente[]; totalCount: number }>;

  abstract findById(id: ProjectAssignedAkzente['id']): Promise<NullableType<ProjectAssignedAkzente>>;

  abstract findByIds(ids: ProjectAssignedAkzente['id'][]): Promise<ProjectAssignedAkzente[]>;

  abstract findByAkzenteId(akzenteId: number): Promise<ProjectAssignedAkzente[]>;

  abstract findByClientCompanyId(clientCompanyId: number): Promise<ProjectAssignedAkzente[]>;

  abstract findByProjectId(projectId: number): Promise<ProjectAssignedAkzente[]>;

  abstract update(
    id: ProjectAssignedAkzente['id'],
    payload: Partial<ProjectAssignedAkzente>,
  ): Promise<ProjectAssignedAkzente | null>;

  abstract remove(id: ProjectAssignedAkzente['id']): Promise<void>;
}