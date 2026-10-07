import { DeepPartial } from '../../../utils/types/deep-partial.type';
import { NullableType } from '../../../utils/types/nullable.type';
import { IPaginationOptions } from '../../../utils/types/pagination-options';
import { ProjectAssignedClient } from '../../domain/project-assigned-client';

export abstract class ProjectAssignedClientRepository {
  abstract create(
    data: Omit<ProjectAssignedClient, 'id' | 'createdAt' | 'updatedAt'>,
  ): Promise<ProjectAssignedClient>;

  abstract findAllWithPagination({
    paginationOptions,
  }: {
    paginationOptions: IPaginationOptions;
  }): Promise<{ data: ProjectAssignedClient[]; totalCount: number }>;

  abstract findById(id: ProjectAssignedClient['id']): Promise<NullableType<ProjectAssignedClient>>;

  abstract findByIds(ids: ProjectAssignedClient['id'][]): Promise<ProjectAssignedClient[]>;

  abstract findByClientId(clientId: number): Promise<ProjectAssignedClient[]>;

  abstract findByClientCompanyId(clientCompanyId: number): Promise<ProjectAssignedClient[]>;

  abstract findByProjectId(projectId: number): Promise<ProjectAssignedClient[]>;

  abstract update(
    id: ProjectAssignedClient['id'],
    payload: Partial<ProjectAssignedClient>,
  ): Promise<ProjectAssignedClient | null>;

  abstract remove(id: ProjectAssignedClient['id']): Promise<void>;
}