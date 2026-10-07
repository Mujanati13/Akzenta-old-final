import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ProjectBranchEntity } from '../entities/project-branch.entity';
import { NullableType } from '../../../../../utils/types/nullable.type';
import { ProjectBranch } from '../../../../domain/project-branch';
import { ProjectBranchRepository } from '../../project-branch.repository';
import { ProjectBranchMapper } from '../mappers/project-branch.mapper';
import { IPaginationOptions } from '../../../../../utils/types/pagination-options';

@Injectable()
export class ProjectBranchRelationalRepository
  implements ProjectBranchRepository
{
  constructor(
    @InjectRepository(ProjectBranchEntity)
    private readonly projectBranchRepository: Repository<ProjectBranchEntity>,
  ) {}

  async create(data: ProjectBranch): Promise<ProjectBranch> {
    const persistenceModel = ProjectBranchMapper.toPersistence(data);
    const newEntity = await this.projectBranchRepository.save(
      this.projectBranchRepository.create(persistenceModel),
    );
    return ProjectBranchMapper.toDomain(newEntity);
  }

  async findAllWithPagination({
    paginationOptions,
  }: {
    paginationOptions: IPaginationOptions;
  }): Promise<{ data: ProjectBranch[]; totalCount: number }> {
    const [entities, totalCount] =
      await this.projectBranchRepository.findAndCount({
        skip: (paginationOptions.page - 1) * paginationOptions.limit,
        take: paginationOptions.limit,
      });

    return {
      data: entities.map((entity) => ProjectBranchMapper.toDomain(entity)),
      totalCount,
    };
  }

  async findById(
    id: ProjectBranch['id'],
  ): Promise<NullableType<ProjectBranch>> {
    const entity = await this.projectBranchRepository.findOne({
      where: { id },
    });

    return entity ? ProjectBranchMapper.toDomain(entity) : null;
  }

  async findByIds(ids: ProjectBranch['id'][]): Promise<ProjectBranch[]> {
    const entities = await this.projectBranchRepository.find({
      where: { id: { $in: ids } as any },
    });
    return entities.map((entity) => ProjectBranchMapper.toDomain(entity));
  }

  async findByProjectAndBranch(
    projectId: number,
    branchId: number,
  ): Promise<NullableType<ProjectBranch>> {
    const entity = await this.projectBranchRepository.findOne({
      where: {
        project: { id: projectId },
        branch: { id: branchId },
      },
    });

    return entity ? ProjectBranchMapper.toDomain(entity) : null;
  }

  async update(
    id: ProjectBranch['id'],
    payload: Partial<ProjectBranch>,
  ): Promise<ProjectBranch | null> {
    const entity = await this.projectBranchRepository.findOne({
      where: { id },
    });

    if (!entity) {
      return null;
    }

    const updatedEntity = await this.projectBranchRepository.save(
      this.projectBranchRepository.create(
        ProjectBranchMapper.toPersistence({
          ...ProjectBranchMapper.toDomain(entity),
          ...payload,
        }),
      ),
    );

    return ProjectBranchMapper.toDomain(updatedEntity);
  }

  async remove(id: ProjectBranch['id']): Promise<void> {
    await this.projectBranchRepository.delete(id);
  }
}
