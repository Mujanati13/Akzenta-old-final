import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, In } from 'typeorm';
import { ProjectAssignedClientEntity } from '../entities/project-assigned-client.entity';
import { NullableType } from '../../../../../utils/types/nullable.type';
import { ProjectAssignedClient } from '../../../../domain/project-assigned-client';
import { ProjectAssignedClientMapper } from '../mappers/project-assigned-client.mapper';
import { IPaginationOptions } from '../../../../../utils/types/pagination-options';
import { ProjectAssignedClientRepository } from '../../project-assigned-client.repository';

const PROJECT_ASSIGNED_CLIENT_RELATIONS = ['client', 'project', 'project.clientCompany'] as const;

@Injectable()
export class ProjectAssignedClientRelationalRepository implements ProjectAssignedClientRepository {
  constructor(
    @InjectRepository(ProjectAssignedClientEntity)
    private readonly projectAssignedClientRepository: Repository<ProjectAssignedClientEntity>,
  ) {}

  async create(data: ProjectAssignedClient): Promise<ProjectAssignedClient> {
    const persistenceModel = ProjectAssignedClientMapper.toPersistence(data);
    const newEntity = await this.projectAssignedClientRepository.save(
      this.projectAssignedClientRepository.create(persistenceModel),
    );
    return ProjectAssignedClientMapper.toDomain(newEntity);
  }

  async findAllWithPagination({
    paginationOptions,
  }: {
    paginationOptions: IPaginationOptions;
  }): Promise<{ data: ProjectAssignedClient[]; totalCount: number }> {
    const entities = await this.projectAssignedClientRepository.find({
      skip: (paginationOptions.page - 1) * paginationOptions.limit,
      take: paginationOptions.limit,
      relations: [...PROJECT_ASSIGNED_CLIENT_RELATIONS],
    });

    const totalCount = await this.projectAssignedClientRepository.count();

    return {
      data: entities.map((entity) => ProjectAssignedClientMapper.toDomain(entity)),
      totalCount,
    };
  }

  async findById(id: ProjectAssignedClient['id']): Promise<NullableType<ProjectAssignedClient>> {
    const entity = await this.projectAssignedClientRepository.findOne({
      where: { id },
    });

    return entity ? ProjectAssignedClientMapper.toDomain(entity) : null;
  }

  async findByIds(ids: ProjectAssignedClient['id'][]): Promise<ProjectAssignedClient[]> {
    const entities = await this.projectAssignedClientRepository.find({
      where: { id: In(ids) },
    });

    return entities.map((entity) => ProjectAssignedClientMapper.toDomain(entity));
  }

  async update(id: ProjectAssignedClient['id'], payload: Partial<ProjectAssignedClient>): Promise<ProjectAssignedClient | null> {
    const entity = await this.projectAssignedClientRepository.findOne({
      where: { id },
    });

    if (!entity) {
      return null;
    }

    const updatedEntity = await this.projectAssignedClientRepository.save(
      this.projectAssignedClientRepository.create(
        ProjectAssignedClientMapper.toPersistence({
          ...ProjectAssignedClientMapper.toDomain(entity),
          ...payload,
        }),
      ),
    );

    return ProjectAssignedClientMapper.toDomain(updatedEntity);
  }

  async remove(id: ProjectAssignedClient['id']): Promise<void> {
    await this.projectAssignedClientRepository.delete(id);
  }

  async findByClientId(clientId: number): Promise<ProjectAssignedClient[]> {
    const entities = await this.projectAssignedClientRepository.find({
      where: { client: { id: clientId } },
      relations: [...PROJECT_ASSIGNED_CLIENT_RELATIONS],
    });

    return entities.map((entity) => ProjectAssignedClientMapper.toDomain(entity));
  }

  async findByClientCompanyId(clientCompanyId: number): Promise<ProjectAssignedClient[]> {
    const entities = await this.projectAssignedClientRepository.find({
      where: { project: { clientCompany: { id: clientCompanyId } } },
      relations: [...PROJECT_ASSIGNED_CLIENT_RELATIONS],
    });

    return entities.map((entity) => ProjectAssignedClientMapper.toDomain(entity));
  }

  async findByProjectId(projectId: number): Promise<ProjectAssignedClient[]> {
    const entities = await this.projectAssignedClientRepository.find({
      where: { project: { id: projectId } },
      relations: [...PROJECT_ASSIGNED_CLIENT_RELATIONS],
    });

    return entities.map((entity) => ProjectAssignedClientMapper.toDomain(entity));
  }
}