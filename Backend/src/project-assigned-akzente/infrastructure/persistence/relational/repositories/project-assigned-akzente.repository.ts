import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, In } from 'typeorm';
import { ProjectAssignedAkzenteEntity } from '../entities/project-assigned-akzente.entity';
import { NullableType } from '../../../../../utils/types/nullable.type';
import { ProjectAssignedAkzente } from '../../../../domain/project-assigned-akzente';
import { ProjectAssignedAkzenteMapper } from '../mappers/project-assigned-akzente.mapper';
import { IPaginationOptions } from '../../../../../utils/types/pagination-options';
import { ProjectAssignedAkzenteRepository } from '../../project-assigned-akzente.repository';

@Injectable()
export class ProjectAssignedAkzenteRelationalRepository implements ProjectAssignedAkzenteRepository {
  constructor(
    @InjectRepository(ProjectAssignedAkzenteEntity)
    private readonly projectAssignedAkzenteRepository: Repository<ProjectAssignedAkzenteEntity>,
  ) {}

  async create(data: ProjectAssignedAkzente): Promise<ProjectAssignedAkzente> {
    const persistenceModel = ProjectAssignedAkzenteMapper.toPersistence(data);
    const newEntity = await this.projectAssignedAkzenteRepository.save(
      this.projectAssignedAkzenteRepository.create(persistenceModel),
    );
    return ProjectAssignedAkzenteMapper.toDomain(newEntity);
  }

  async findAllWithPagination({
    paginationOptions,
  }: {
    paginationOptions: IPaginationOptions;
  }): Promise<{ data: ProjectAssignedAkzente[]; totalCount: number }> {
    const entities = await this.projectAssignedAkzenteRepository.find({
      skip: (paginationOptions.page - 1) * paginationOptions.limit,
      take: paginationOptions.limit,
      relations: ['akzente', 'project'],
    });

    const totalCount = await this.projectAssignedAkzenteRepository.count();

    return {
      data: entities.map((entity) => ProjectAssignedAkzenteMapper.toDomain(entity)),
      totalCount,
    };
  }

  async findById(id: ProjectAssignedAkzente['id']): Promise<NullableType<ProjectAssignedAkzente>> {
    const entity = await this.projectAssignedAkzenteRepository.findOne({
      where: { id },
    });

    return entity ? ProjectAssignedAkzenteMapper.toDomain(entity) : null;
  }

  async findByIds(ids: ProjectAssignedAkzente['id'][]): Promise<ProjectAssignedAkzente[]> {
    const entities = await this.projectAssignedAkzenteRepository.find({
      where: { id: In(ids) },
    });

    return entities.map((entity) => ProjectAssignedAkzenteMapper.toDomain(entity));
  }

  async update(id: ProjectAssignedAkzente['id'], payload: Partial<ProjectAssignedAkzente>): Promise<ProjectAssignedAkzente | null> {
    const entity = await this.projectAssignedAkzenteRepository.findOne({
      where: { id },
    });

    if (!entity) {
      return null;
    }

    const updatedEntity = await this.projectAssignedAkzenteRepository.save(
      this.projectAssignedAkzenteRepository.create(
        ProjectAssignedAkzenteMapper.toPersistence({
          ...ProjectAssignedAkzenteMapper.toDomain(entity),
          ...payload,
        }),
      ),
    );

    return ProjectAssignedAkzenteMapper.toDomain(updatedEntity);
  }

  async remove(id: ProjectAssignedAkzente['id']): Promise<void> {
    await this.projectAssignedAkzenteRepository.delete(id);
  }

  async findByAkzenteId(akzenteId: number): Promise<ProjectAssignedAkzente[]> {
    const entities = await this.projectAssignedAkzenteRepository.find({
      where: { akzente: { id: akzenteId } },
      relations: ['akzente', 'project'],
    });

    return entities.map((entity) => ProjectAssignedAkzenteMapper.toDomain(entity));
  }

  async findByClientCompanyId(clientCompanyId: number): Promise<ProjectAssignedAkzente[]> {
    const entities = await this.projectAssignedAkzenteRepository.find({
      where: { project: { id: clientCompanyId } },
      relations: ['akzente', 'project'],
    });

    return entities.map((entity) => ProjectAssignedAkzenteMapper.toDomain(entity));
  }

  async findByProjectId(projectId: number): Promise<ProjectAssignedAkzente[]> {
    const entities = await this.projectAssignedAkzenteRepository.find({
      where: { project: { id: projectId } },
      relations: ['akzente', 'akzente.user', 'project'],
    });

    return entities.map((entity) => ProjectAssignedAkzenteMapper.toDomain(entity));
  }
}