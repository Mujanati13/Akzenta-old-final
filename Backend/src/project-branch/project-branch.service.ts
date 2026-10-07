import { Injectable } from '@nestjs/common';
import { CreateProjectBranchDto } from './dto/create-project-branch.dto';
import { UpdateProjectBranchDto } from './dto/update-project-branch.dto';
import { ProjectBranchRepository } from './infrastructure/persistence/project-branch.repository';
import { IPaginationOptions } from '../utils/types/pagination-options';
import { ProjectBranch } from './domain/project-branch';
import { ProjectService } from '../project/project.service';
import { BranchService } from '../branch/branch.service';
import { Project } from '../project/domain/project';
import { Branch } from '../branch/domain/branch';

@Injectable()
export class ProjectBranchService {
  constructor(
    private readonly projectBranchRepository: ProjectBranchRepository,
    private readonly projectService: ProjectService,
    private readonly branchService: BranchService,
  ) {}

  async create(
    createProjectBranchDto: CreateProjectBranchDto,
  ): Promise<ProjectBranch> {
    const project = await this.projectService.findById(
      createProjectBranchDto.project.id,
    );
    if (!project) {
      throw new Error('Project not found');
    }

    const branch = await this.branchService.findById(
      createProjectBranchDto.branch.id,
    );
    if (!branch) {
      throw new Error('Branch not found');
    }

    // Check if relationship already exists
    const existing = await this.projectBranchRepository.findByProjectAndBranch(
      project.id,
      branch.id,
    );

    if (existing) {
      return existing;
    }

    return this.projectBranchRepository.create({
      project,
      branch,
    });
  }

  findAllWithPagination({
    paginationOptions,
  }: {
    paginationOptions: IPaginationOptions;
  }) {
    return this.projectBranchRepository.findAllWithPagination({
      paginationOptions: {
        page: paginationOptions.page,
        limit: paginationOptions.limit,
      },
    });
  }

  findById(id: ProjectBranch['id']) {
    return this.projectBranchRepository.findById(id);
  }

  findByIds(ids: ProjectBranch['id'][]) {
    return this.projectBranchRepository.findByIds(ids);
  }

  async update(
    id: ProjectBranch['id'],
    updateProjectBranchDto: UpdateProjectBranchDto,
  ) {
    let projectUpdate: Project | undefined = undefined;
    let branchUpdate: Branch | undefined = undefined;

    if (updateProjectBranchDto.project) {
      const foundProject = await this.projectService.findById(
        updateProjectBranchDto.project.id,
      );
      if (!foundProject) {
        throw new Error('Project not found');
      }
      projectUpdate = foundProject;
    }

    if (updateProjectBranchDto.branch) {
      const foundBranch = await this.branchService.findById(
        updateProjectBranchDto.branch.id,
      );
      if (!foundBranch) {
        throw new Error('Branch not found');
      }
      branchUpdate = foundBranch;
    }

    return this.projectBranchRepository.update(id, {
      project: projectUpdate,
      branch: branchUpdate,
    });
  }

  remove(id: ProjectBranch['id']) {
    return this.projectBranchRepository.remove(id);
  }
}
