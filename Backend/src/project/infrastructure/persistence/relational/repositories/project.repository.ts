import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ProjectEntity } from '../entities/project.entity';
import { NullableType } from '../../../../../utils/types/nullable.type';
import { Project } from '../../../../domain/project';
import { ProjectRepository } from '../../project.repository';
import { ProjectMapper } from '../mappers/project.mapper';
import { IPaginationOptions } from '../../../../../utils/types/pagination-options';

@Injectable()
export class ProjectRelationalRepository implements ProjectRepository {
  constructor(
    @InjectRepository(ProjectEntity)
    private readonly projectRepository: Repository<ProjectEntity>,
  ) {}

  async create(data: Project): Promise<Project> {
    const persistenceModel = ProjectMapper.toPersistence(data);
    const newEntity = await this.projectRepository.save(
      this.projectRepository.create(persistenceModel),
    );
    return ProjectMapper.toDomain(newEntity);
  }

  async findAllWithPagination({
    paginationOptions,
  }: {
    paginationOptions: IPaginationOptions;
  }): Promise<{ data: Project[]; totalCount: number }> {
    const [entities, totalCount] = await this.projectRepository.findAndCount({
      skip: (paginationOptions.page - 1) * paginationOptions.limit,
      take: paginationOptions.limit,
      order: {
        name: 'ASC', // Default order by name ascending
      },
    });

    return {
      data: entities.map((entity) => ProjectMapper.toDomain(entity)),
      totalCount,
    };
  }

  async findById(id: Project['id']): Promise<NullableType<Project>> {
    const entity = await this.projectRepository.findOne({
      where: { id },
      relations: ['clientCompany'],
    });
    return entity ? ProjectMapper.toDomain(entity) : null;
  }

  async findByIds(ids: Project['id'][]): Promise<Project[]> {
    const entities = await this.projectRepository.find({
      where: { id: { $in: ids } as any },
    });
    return entities.map((entity) => ProjectMapper.toDomain(entity));
  }

  async findByClientCompanyId(clientCompanyId: number): Promise<Project[]> {
    const entities = await this.projectRepository.find({
      where: { clientCompany: { id: clientCompanyId } },
      relations: ['clientCompany', 'questions'],
    });
    return entities.map((entity) => ProjectMapper.toDomain(entity));
  }

  async update(
    id: Project['id'],
    payload: Partial<Project>,
  ): Promise<Project | null> {
    const entity = await this.projectRepository.findOne({
      where: { id },
    });

    if (!entity) {
      return null;
    }

    const updatedEntity = await this.projectRepository.save(
      this.projectRepository.create(
        ProjectMapper.toPersistence({
          ...ProjectMapper.toDomain(entity),
          ...payload,
        }),
      ),
    );

    return ProjectMapper.toDomain(updatedEntity);
  }

  async remove(id: Project['id']): Promise<void> {
    await this.projectRepository.delete(id);
  }
}
