import { Injectable } from '@nestjs/common';
import { CreateProjectAssignedClientDto } from './dto/create-project-assigned-client.dto';
import { UpdateProjectAssignedClientDto } from './dto/update-project-assigned-client.dto';
import { IPaginationOptions } from '../utils/types/pagination-options';
import { ProjectAssignedClient } from './domain/project-assigned-client';
import { ProjectAssignedClientRepository } from './infrastructure/persistence/project-assigned-client.repository';
import { Client } from '../client/domain/client';
import { Project } from '../project/domain/project';

@Injectable()
export class ProjectAssignedClientService {
  constructor(
    private readonly projectAssignedClientRepository: ProjectAssignedClientRepository,
  ) {}

  async create(createProjectAssignedClientDto: CreateProjectAssignedClientDto): Promise<ProjectAssignedClient> {
    // Convert DTOs to domain objects
    const client = new Client();
    client.id = createProjectAssignedClientDto.client.id;

    const project = new Project();
    project.id = createProjectAssignedClientDto.project.id;

    const clonedPayload = {
      client,
      project,
    };

    return this.projectAssignedClientRepository.create(clonedPayload);
  }

  async findAllWithPagination({
    paginationOptions,
  }: {
    paginationOptions: IPaginationOptions;
  }): Promise<{ data: ProjectAssignedClient[]; hasNextPage: boolean }> {
    const result = await this.projectAssignedClientRepository.findAllWithPagination({
      paginationOptions,
    });

    return {
      data: result.data,
      hasNextPage: result.data.length === paginationOptions.limit,
    };
  }

  // Add this method to find assignments by client ID
  async findByClientId(clientId: number): Promise<ProjectAssignedClient[]> {
    return this.projectAssignedClientRepository.findByClientId(clientId);
  }

  // Add this method to find assignments by client company ID
  async findByClientCompanyId(clientCompanyId: number): Promise<ProjectAssignedClient[]> {
    return this.projectAssignedClientRepository.findByClientCompanyId(clientCompanyId);
  }

  // Add this method to find assignments by project ID
  async findByProjectId(projectId: number): Promise<ProjectAssignedClient[]> {
    return this.projectAssignedClientRepository.findByProjectId(projectId);
  }

  findById(id: ProjectAssignedClient['id']) {
    return this.projectAssignedClientRepository.findById(id);
  }

  findByIds(ids: ProjectAssignedClient['id'][]) {
    return this.projectAssignedClientRepository.findByIds(ids);
  }

  async update(id: ProjectAssignedClient['id'], updateProjectAssignedClientDto: UpdateProjectAssignedClientDto) {
    const domainPayload: Partial<ProjectAssignedClient> = {};

    if (updateProjectAssignedClientDto.client) {
      const client = new Client();
      client.id = updateProjectAssignedClientDto.client.id;
      domainPayload.client = client;
    }

    if (updateProjectAssignedClientDto.project) {
      const project = new Project();
      project.id = updateProjectAssignedClientDto.project.id;
      domainPayload.project = project;
    }

    return this.projectAssignedClientRepository.update(id, domainPayload);
  }

  remove(id: ProjectAssignedClient['id']) {
    return this.projectAssignedClientRepository.remove(id);
  }
}