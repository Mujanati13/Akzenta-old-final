import { Injectable } from '@nestjs/common';
import { CreateProjectAssignedAkzenteDto } from './dto/create-project-assigned-akzente.dto';
import { UpdateProjectAssignedAkzenteDto } from './dto/update-project-assigned-akzente.dto';
import { IPaginationOptions } from '../utils/types/pagination-options';
import { ProjectAssignedAkzente } from './domain/project-assigned-akzente';
import { ProjectAssignedAkzenteRepository } from './infrastructure/persistence/project-assigned-akzente.repository';
import { Akzente } from '../akzente/domain/akzente';
import { Project } from '../project/domain/project';

@Injectable()
export class ProjectAssignedAkzenteService {
  constructor(
    private readonly projectAssignedAkzenteRepository: ProjectAssignedAkzenteRepository,
  ) {}

  async create(createProjectAssignedAkzenteDto: CreateProjectAssignedAkzenteDto): Promise<ProjectAssignedAkzente> {
    // Convert DTOs to domain objects
    const akzente = new Akzente();
    akzente.id = createProjectAssignedAkzenteDto.akzente.id;

    const project = new Project();
    project.id = createProjectAssignedAkzenteDto.project.id;

    const clonedPayload = {
      akzente,
      project,
    };

    return this.projectAssignedAkzenteRepository.create(clonedPayload);
  }

  async findAllWithPagination({
    paginationOptions,
  }: {
    paginationOptions: IPaginationOptions;
  }): Promise<{ data: ProjectAssignedAkzente[]; hasNextPage: boolean }> {
    const result = await this.projectAssignedAkzenteRepository.findAllWithPagination({
      paginationOptions,
    });

    return {
      data: result.data,
      hasNextPage: result.data.length === paginationOptions.limit,
    };
  }

  // Add this method to find assignments by client ID
  async findByAkzenteId(akzenteId: number): Promise<ProjectAssignedAkzente[]> {
    return this.projectAssignedAkzenteRepository.findByAkzenteId(akzenteId);
  }

  // Add this method to find assignments by client company ID
  async findByClientCompanyId(clientCompanyId: number): Promise<ProjectAssignedAkzente[]> {
    return this.projectAssignedAkzenteRepository.findByClientCompanyId(clientCompanyId);
  }

  // Add this method to find assignments by project ID
  async findByProjectId(projectId: number): Promise<ProjectAssignedAkzente[]> {
    return this.projectAssignedAkzenteRepository.findByProjectId(projectId);
  }

  findById(id: ProjectAssignedAkzente['id']) {
    return this.projectAssignedAkzenteRepository.findById(id);
  }

  findByIds(ids: ProjectAssignedAkzente['id'][]) {
    return this.projectAssignedAkzenteRepository.findByIds(ids);
  }

  async update(id: ProjectAssignedAkzente['id'], updateProjectAssignedAkzenteDto: UpdateProjectAssignedAkzenteDto) {
    const domainPayload: Partial<ProjectAssignedAkzente> = {};

    if (updateProjectAssignedAkzenteDto.akzente) {
      const akzente = new Akzente();
      akzente.id = updateProjectAssignedAkzenteDto.akzente.id;
      domainPayload.akzente = akzente;
    }

    if (updateProjectAssignedAkzenteDto.project) {
      const project = new Project();
      project.id = updateProjectAssignedAkzenteDto.project.id;
      domainPayload.project = project;
    }

    return this.projectAssignedAkzenteRepository.update(id, domainPayload);
  }

  remove(id: ProjectAssignedAkzente['id']) {
    return this.projectAssignedAkzenteRepository.remove(id);
  }
}