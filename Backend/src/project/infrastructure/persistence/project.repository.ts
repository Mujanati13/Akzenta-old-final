import { DeepPartial } from '../../../utils/types/deep-partial.type';
import { NullableType } from '../../../utils/types/nullable.type';
import { IPaginationOptions } from '../../../utils/types/pagination-options';
import { Project } from '../../domain/project';

export abstract class ProjectRepository {
  abstract create(
    data: Omit<Project, 'id' | 'createdAt' | 'updatedAt'>,
  ): Promise<Project>;

  abstract findAllWithPagination({
    paginationOptions,
  }: {
    paginationOptions: IPaginationOptions;
  }): Promise<{ data: Project[]; totalCount: number }>;

  abstract findById(id: Project['id']): Promise<NullableType<Project>>;

  abstract findByIds(ids: Project['id'][]): Promise<Project[]>;

  abstract findByClientCompanyId(clientCompanyId: number): Promise<Project[]>;

  abstract update(
    id: Project['id'],
    payload: DeepPartial<Project>,
  ): Promise<Project | null>;

  abstract remove(id: Project['id']): Promise<void>;
}
