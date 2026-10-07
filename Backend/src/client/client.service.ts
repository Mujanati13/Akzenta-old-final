import { Injectable, Inject, forwardRef } from '@nestjs/common';
import { CreateClientDto } from './dto/create-client.dto';
import { UpdateClientDto } from './dto/update-client.dto';
import { ClientRepository } from './infrastructure/persistence/client.repository';
import { IPaginationOptions } from '../utils/types/pagination-options';
import { Client } from './domain/client';
import { UsersService } from '../users/users.service';
import { User } from '../users/domain/user';
import { ProjectAssignedClientService } from '../project-assigned-client/project-assigned-client.service';
import { ClientFavoriteProjectService } from '../client-favorite-projects/client-favorite-projects.service';
import { ClientFavoriteReportsService } from '../client-favorite-reports/client-favorite-reports.service';
import { ReportService } from '../report/report.service';
import { ProjectService } from '../project/project.service';
import { ReportStatusEnum } from '../report-status/dto/status.enum';

@Injectable()
export class ClientService {
  constructor(
    private readonly clientRepository: ClientRepository,
    @Inject(forwardRef(() => UsersService))
    private readonly usersService: UsersService,
    @Inject(forwardRef(() => ProjectAssignedClientService))
    private readonly projectAssignedClientService: ProjectAssignedClientService,
    @Inject(forwardRef(() => ClientFavoriteProjectService))
    private readonly clientFavoriteProjectsService: ClientFavoriteProjectService,
    @Inject(forwardRef(() => ClientFavoriteReportsService))
    private readonly clientFavoriteReportsService: ClientFavoriteReportsService,
    @Inject(forwardRef(() => ReportService))
    private readonly reportService: ReportService,
    @Inject(forwardRef(() => ProjectService))
    private readonly projectService: ProjectService,
  ) {}

  async create(createClientDto: CreateClientDto): Promise<Client> {
    const user = await this.usersService.findById(createClientDto.user.id);
    if (!user) {
      throw new Error('User not found');
    }

    return this.clientRepository.create({
      user,
      isSales: createClientDto.isSales ?? false,
    });
  }

  findAllWithPagination({
    paginationOptions,
  }: {
    paginationOptions: IPaginationOptions;
  }) {
    return this.clientRepository.findAllWithPagination({
      paginationOptions: {
        page: paginationOptions.page,
        limit: paginationOptions.limit,
      },
    });
  }

  findById(id: Client['id']) {
    return this.clientRepository.findById(id);
  }

  findByUserId(userId: User['id']) {
    return this.clientRepository.findByUserId(userId);
  }

  findByIds(ids: Client['id'][]) {
    return this.clientRepository.findByIds(ids);
  }

  async update(id: Client['id'], updateClientDto: UpdateClientDto) {
    let user: User | undefined = undefined;

    if (updateClientDto.user) {
      const foundUser = await this.usersService.findById(
        updateClientDto.user.id,
      );
      if (!foundUser) {
        throw new Error('User not found');
      }
      user = foundUser;
    }

    return this.clientRepository.update(id, {
      user,
      ...(updateClientDto.isSales !== undefined
        ? { isSales: updateClientDto.isSales }
        : {}),
    });
  }

  remove(id: Client['id']) {
    return this.clientRepository.remove(id);
  }

  /**
   * Helper method to add favorite status to projects
   */
  private async addFavoriteStatusToProjects(projects: any[], userId?: number): Promise<any[]> {
    if (!userId) {
      // If no user ID, all projects are not favorited
      return projects.map(project => ({ ...project, isFavorite: false }));
    }

    try {
      // Find the Client entity for this user
      const clientEntity = await this.findByUserId(userId);
      if (!clientEntity) {
        // If no Client entity found, all projects are not favorited
        return projects.map(project => ({ ...project, isFavorite: false }));
      }

      // Get all favorite projects for this Client user
      const allFavorites = await this.clientFavoriteProjectsService.findByClientId(clientEntity.id);
      const favoriteProjectIds = allFavorites.map(fav => fav.project.id);

      // Add isFavorite field to each project
      return projects.map(project => ({
        ...project,
        isFavorite: favoriteProjectIds.includes(project.id)
      }));
    } catch (error) {
      // If there's an error, assume all projects are not favorited
      console.error('Error adding favorite status to projects:', error);
      return projects.map(project => ({ ...project, isFavorite: false }));
    }
  }

  /**
   * Optimized helper method to get report counts for projects by status categories
   * Uses a single database query instead of 8 separate queries
   */
  private async getReportCountsForProjects(projectIds: number[]): Promise<Map<number, { newReports: number; ongoingReports: number; completedReports: number }>> {
    if (!projectIds || projectIds.length === 0) {
      return new Map();
    }

    try {
      // Use the optimized method from ReportService
      return await this.reportService.getReportCountsByStatusCategories(
        projectIds,
        'client',
      );
    } catch (error) {
      console.error('Error getting report counts for projects:', error);
      // Return empty counts if there's an error
      const emptyCountsMap = new Map<number, { newReports: number; ongoingReports: number; completedReports: number }>();
      projectIds.forEach(projectId => {
        emptyCountsMap.set(projectId, { newReports: 0, ongoingReports: 0, completedReports: 0 });
      });
      return emptyCountsMap;
    }
  }

  async getDashboardData(userId: number, clientCompanyId?: number) {
    // Validate userId
    if (!userId || isNaN(userId) || userId <= 0) {
      throw new Error('Invalid user ID provided');
    }

    // Find the client record for this user
    const client = await this.findByUserId(userId);
    if (!client) {
      throw new Error('Client profile not found for user');
    }

    // Get projects assigned to this client
    const projectAssignments = await this.projectAssignedClientService.findByClientId(client.id);
    
    // Extract projects from assignments
    let assignedProjects = projectAssignments.map(assignment => assignment.project);

    if (clientCompanyId) {
      assignedProjects = assignedProjects.filter(
        (project) => project.clientCompany?.id === clientCompanyId,
      );
    }

    // Get project IDs for report counting
    const projectIds = assignedProjects.map(project => project.id);

    // Get report counts for all projects
    const reportCountsMap = await this.getReportCountsForProjects(projectIds);

    // Add favorite status and report counts to projects
    const assignedProjectsWithFavorites = await this.addFavoriteStatusToProjects(assignedProjects, userId);
    
    // Add report counts and reported percentage to each project
    const assignedProjectsWithCounts = await Promise.all(assignedProjectsWithFavorites.map(async (project) => {
      const reportCounts = reportCountsMap.get(project.id) || { newReports: 0, ongoingReports: 0, completedReports: 0 };
      
      // Calculate reported percentage
      const reports = await this.reportService.findByProjectId(project.id);
      const reportedPercentage = this.projectService.calculateReportedPercentage(reports);
      const uniqueBranches = new Set<number>();
      reports.forEach((report) => {
        if (report?.branch?.id) {
          uniqueBranches.add(Number(report.branch.id));
        }
      });
      const branchesCount = uniqueBranches.size;
      
      return {
        ...project,
        reportCounts: {
          newReports: reportCounts.newReports,
          ongoingReports: reportCounts.ongoingReports,
          completedReports: reportCounts.completedReports,
        },
        reportedPercentage,
        branchesCount,
      };
    }));

    return {
      assignedProjects: assignedProjectsWithCounts,
    };
  }

  async getUserFavorites(userId: number) {
    // Validate userId
    if (!userId || isNaN(userId) || userId <= 0) {
      throw new Error('Invalid user ID provided');
    }

    // Find the client record for this user
    const client = await this.findByUserId(userId);
    if (!client) {
      throw new Error('Client profile not found for user');
    }

    // Get favorite reports (missions)
    const favoriteReports = await this.clientFavoriteReportsService.findByClientId(client.id);
    const reports = favoriteReports.map(fav => fav.report);

    // Get favorite projects
    const favoriteProjects = await this.clientFavoriteProjectsService.findByClientId(client.id);
    const projects = favoriteProjects.map(fav => fav.project);

    // Get project IDs for report counting
    const projectIds = projects.map(project => project.id);

    // Get report counts for all favorite projects
    const reportCountsMap = await this.getReportCountsForProjects(projectIds);

    // Add report counts to each favorite project
    const projectsWithCounts = projects.map(project => {
      const reportCounts = reportCountsMap.get(project.id) || { newReports: 0, ongoingReports: 0, completedReports: 0 };
      
      return {
        ...project,
        reportCounts: {
          newReports: reportCounts.newReports,
          ongoingReports: reportCounts.ongoingReports,
          completedReports: reportCounts.completedReports,
        }
      };
    });

    return {
      favoriteReports: reports,
      favoriteProjects: projectsWithCounts,
    };
  }


}
