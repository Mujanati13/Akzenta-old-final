import { Injectable, Inject, forwardRef } from '@nestjs/common';
import { CreateAkzenteDto } from './dto/create-akzente.dto';
import { UpdateAkzenteDto } from './dto/update-akzente.dto';
import { AkzenteRepository } from './infrastructure/persistence/akzente.repository';
import { IPaginationOptions } from '../utils/types/pagination-options';
import { Akzente } from './domain/akzente';
import { UsersService } from '../users/users.service';
import { User } from '../users/domain/user';
import { AkzenteFavoriteClientCompaniesService } from '../akzente-favorite-client-companies/akzente-favorite-client-companies.service';
import { AkzenteFavoriteReportsService } from '../akzente-favorite-reports/akzente-favorite-reports.service';
import { AkzenteFavoriteProjectService } from '../akzente-favorite-projects/akzente-favorite-project.service';
import { ReportService } from '../report/report.service';
import { ReportStatusEnum } from '../report-status/dto/status.enum';
import { categorizeReportCount } from '../report-status/report-status.util';
import { StatusService } from '../report-status/status.service';
import { ProjectService } from '../project/project.service';
import { ClientCompanyService } from '../client-company/client-company.service';
import { ProjectAssignedAkzenteService } from '../project-assigned-akzente/project-assigned-akzente.service';

@Injectable()
export class AkzenteService {
  private readonly DASHBOARD_CLIENT_LIMIT = 4;
  private readonly DASHBOARD_ASSIGNED_LIMIT = 24;

  constructor(
    private readonly akzenteRepository: AkzenteRepository,
    @Inject(forwardRef(() => UsersService))
    private readonly usersService: UsersService,
    @Inject(forwardRef(() => AkzenteFavoriteClientCompaniesService))
    private readonly akzenteFavoriteClientCompaniesService: AkzenteFavoriteClientCompaniesService,
    @Inject(forwardRef(() => AkzenteFavoriteReportsService))
    private readonly akzenteFavoriteReportsService: AkzenteFavoriteReportsService,
    @Inject(forwardRef(() => AkzenteFavoriteProjectService))
    private readonly akzenteFavoriteProjectService: AkzenteFavoriteProjectService,
    @Inject(forwardRef(() => ReportService))
    private readonly reportService: ReportService,
    @Inject(forwardRef(() => StatusService))
    private readonly statusService: StatusService,
    @Inject(forwardRef(() => ProjectService))
    private readonly projectService: ProjectService,
    @Inject(forwardRef(() => ClientCompanyService))
    private readonly clientCompanyService: ClientCompanyService,
    @Inject(forwardRef(() => ProjectAssignedAkzenteService))
    private readonly projectAssignedAkzenteService: ProjectAssignedAkzenteService,
  ) { }

  async create(createAkzenteDto: CreateAkzenteDto): Promise<Akzente> {
    const user = await this.usersService.findById(createAkzenteDto.user.id);
    if (!user) {
      throw new Error('User not found');
    }

    return this.akzenteRepository.create({
      user,
    });
  }

  findAllWithPagination({
    paginationOptions,
  }: {
    paginationOptions: IPaginationOptions;
  }) {
    return this.akzenteRepository.findAllWithPagination({
      paginationOptions: {
        page: paginationOptions.page,
        limit: paginationOptions.limit,
      },
    });
  }

  findById(id: Akzente['id']) {
    return this.akzenteRepository.findById(id);
  }

  findByUserId(userId: User['id']) {
    return this.akzenteRepository.findByUserId(userId);
  }

  findByIds(ids: Akzente['id'][]) {
    return this.akzenteRepository.findByIds(ids);
  }

  async update(id: Akzente['id'], updateAkzenteDto: UpdateAkzenteDto) {
    let user: User | undefined = undefined;

    if (updateAkzenteDto.user) {
      const foundUser = await this.usersService.findById(
        updateAkzenteDto.user.id,
      );
      if (!foundUser) {
        throw new Error('User not found');
      }
      user = foundUser;
    }

    return this.akzenteRepository.update(id, {
      user,
    });
  }

  remove(id: Akzente['id']) {
    return this.akzenteRepository.remove(id);
  }

  /**
   * Helper method to get report counts for client companies
   */
  private async getReportCountsForClientCompanies(clientCompanyIds: number[]): Promise<Map<number, { newReports: number; ongoingReports: number; completedReports: number }>> {
    if (!clientCompanyIds || clientCompanyIds.length === 0) {
      return new Map();
    }

    try {
      // Get all projects for all client companies
      const allProjects = await Promise.all(
        clientCompanyIds.map(clientCompanyId =>
          this.projectService.findByClientCompanyId(clientCompanyId)
        )
      );

      // Flatten all projects and create a map of client company -> project IDs
      const clientCompanyToProjectIds = new Map<number, number[]>();
      allProjects.forEach((projects, index) => {
        const clientCompanyId = clientCompanyIds[index];
        const projectIds = projects.map(project => project.id);
        clientCompanyToProjectIds.set(clientCompanyId, projectIds);
      });

      // Get all project IDs
      const allProjectIds = allProjects.flat().map(project => project.id);

      if (allProjectIds.length === 0) {
        // No projects found, return empty counts
        const emptyCountsMap = new Map<number, { newReports: number; ongoingReports: number; completedReports: number }>();
        clientCompanyIds.forEach(clientCompanyId => {
          emptyCountsMap.set(clientCompanyId, { newReports: 0, ongoingReports: 0, completedReports: 0 });
        });
        return emptyCountsMap;
      }

      // Single query to get ALL reports for ALL projects
      const allReports = await this.reportService.findByProjectIds(allProjectIds);

      // Initialize counts map
      const reportCountsMap = new Map<number, { newReports: number; ongoingReports: number; completedReports: number }>();
      clientCompanyIds.forEach(clientCompanyId => {
        reportCountsMap.set(clientCompanyId, { newReports: 0, ongoingReports: 0, completedReports: 0 });
      });

      // Count reports by client company and status category
      allReports.forEach(report => {
        const projectId = report.project.id;
        const statusId = report.status.id;

        // Find which client company this project belongs to
        for (const [clientCompanyId, projectIds] of clientCompanyToProjectIds) {
          if (projectIds.includes(projectId)) {
            const counts = reportCountsMap.get(clientCompanyId);
            if (counts) {
              const category = categorizeReportCount(statusId, 'akzente');
              if (category === 'new') {
                counts.newReports++;
              } else if (category === 'completed') {
                counts.completedReports++;
              } else if (category === 'ongoing') {
                counts.ongoingReports++;
              }
            }
            break; // Found the client company, no need to continue
          }
        }
      });

      return reportCountsMap;
    } catch (error) {
      console.error('Error getting report counts for client companies:', error);
      // Return empty counts if there's an error
      const emptyCountsMap = new Map<number, { newReports: number; ongoingReports: number; completedReports: number }>();
      clientCompanyIds.forEach(clientCompanyId => {
        emptyCountsMap.set(clientCompanyId, { newReports: 0, ongoingReports: 0, completedReports: 0 });
      });
      return emptyCountsMap;
    }
  }

  async getUserFavorites(userId: number) {

    // Validate userId
    if (!userId || isNaN(userId) || userId <= 0) {
      console.error('❌ Invalid user ID in service:', {
        userId,
        userIdType: typeof userId,
        isNaN: isNaN(userId),
      });
      throw new Error('Invalid user ID provided');
    }

    // Find the akzente record for this user
    const akzente = await this.findByUserId(userId);
    if (!akzente) {
      throw new Error('Akzente profile not found for user');
    }

    // Get favorite client companies
    const favoriteClientCompanies = await this.akzenteFavoriteClientCompaniesService.findByAkzenteId(akzente.id);
    const clientCompanies = favoriteClientCompanies.map(fav => fav.clientCompany);

    // Get assigned client companies to determine isMyClient flag
    const assignedResult = await this.clientCompanyService.findAssignedCompaniesForAkzenteUser({
      paginationOptions: { page: 1, limit: 1000 },
      userId,
    });
    const assignedClientIds = new Set((assignedResult?.data || []).map((company: any) => company.id));

    // Get report counts for favorite client companies
    const clientCompanyIds = clientCompanies.map(company => company.id);
    const reportCountsMap = await this.getReportCountsForClientCompanies(clientCompanyIds);

    // Add report counts and isMyClient flag to favorite client companies
    const clientCompaniesWithCounts = clientCompanies.map(company => {
      const reportCounts = reportCountsMap.get(company.id) || { newReports: 0, ongoingReports: 0, completedReports: 0 };
      return {
        ...company,
        reportCounts: {
          newReports: reportCounts.newReports,
          ongoingReports: reportCounts.ongoingReports,
          completedReports: reportCounts.completedReports,
        },
        isMyClient: assignedClientIds.has(company.id),
      };
    });

    // Get favorite reports (missions)
    const favoriteReports = await this.akzenteFavoriteReportsService.findByAkzenteId(akzente.id);
    const reports = favoriteReports.map(fav => fav.report);

    // Get favorite projects
    const favoriteProjects = await this.akzenteFavoriteProjectService.findByAkzenteId(akzente.id);
    const projects = favoriteProjects.map(fav => fav.project);

    return {
      favoriteClientCompanies: clientCompaniesWithCounts,
      favoriteReports: reports,
      favoriteProjects: projects,
    };
  }


  /**
   * Helper method to apply status filtering to reports based on user type
   */
  private async applyStatusFilteringToReports(reports: any[], userType: 'akzente' | 'client' | 'merchandiser'): Promise<any[]> {
    if (!reports || reports.length === 0) {
      return reports;
    }

    try {
      return reports.map(report => {
        if (!report.status) return report;
        // Get the user-type-specific name and color
        const userSpecificName = this.statusService.getStatusNameForUserType(report.status, userType);
        const userSpecificColor = this.statusService.getStatusColorForUserType(report.status, userType);

        const filteredStatus = {
          id: report.status.id,
          name: userSpecificName,
          color: userSpecificColor,
        };

        return {
          ...report,
          status: filteredStatus
        };
      });
    } catch (error) {
      // If there's an error, return reports without filtering
      console.error('Error applying status filtering to reports:', error);
      return reports;
    }
  }

  private async getDashboardClientCompanies(userId: number): Promise<{ dashboardClients: any[]; totalCount: number; assignedClients: any[]; assignedTotalCount: number }> {
    if (!this.clientCompanyService) {
      return { dashboardClients: [], totalCount: 0, assignedClients: [], assignedTotalCount: 0 };
    }

    try {
      const [assignedResult, allClientsResult] = await Promise.all([
        this.clientCompanyService.findAssignedCompaniesForAkzenteUser({
          paginationOptions: { page: 1, limit: this.DASHBOARD_ASSIGNED_LIMIT },
          userId,
        }),
        this.clientCompanyService.findAllWithPaginationAndFavorites({
          paginationOptions: { page: 1, limit: this.DASHBOARD_CLIENT_LIMIT * 2 },
          userId,
        }),
      ]);

      const assignedClientCompanies = assignedResult?.data || [];
      const assignedTotalCount = assignedResult?.totalCount ?? assignedClientCompanies.length;

      const assignedClients = assignedClientCompanies.map((company: any) => ({
        ...company,
        isFavorite: company?.isFavorite ?? false,
        reportCounts: company?.reportCounts ?? { newReports: 0, ongoingReports: 0, completedReports: 0 },
      }));

      const sortByCreatedAtDesc = (a: any, b: any) => {
        const dateA = new Date(a?.createdAt ?? 0).getTime();
        const dateB = new Date(b?.createdAt ?? 0).getTime();
        return dateB - dateA;
      };

      const prioritizedAssigned = assignedClients
        .slice()
        .sort(sortByCreatedAtDesc)
        .slice(0, this.DASHBOARD_CLIENT_LIMIT);

      const myClientIds = new Set(prioritizedAssigned.map((company: any) => company.id));

      const dashboardClients = prioritizedAssigned.map((company: any) => ({
        ...company,
        isMyClient: true,
      }));

      const needed = this.DASHBOARD_CLIENT_LIMIT - dashboardClients.length;

      if (needed > 0) {
        const fallbackClients = (allClientsResult?.data || [])
          .filter((company: any) => !myClientIds.has(company.id))
          .sort(sortByCreatedAtDesc)
          .slice(0, needed)
          .map((company: any) => ({
            ...company,
            isMyClient: false,
          }));

        dashboardClients.push(...fallbackClients);
      }

      const sortedDashboardClients = dashboardClients
        .sort((a: any, b: any) => {
          if (a.isMyClient && !b.isMyClient) {
            return -1;
          }
          if (!a.isMyClient && b.isMyClient) {
            return 1;
          }
          return sortByCreatedAtDesc(a, b);
        })
        .slice(0, this.DASHBOARD_CLIENT_LIMIT);

      const totalCount = allClientsResult?.totalCount ?? sortedDashboardClients.length;

      return {
        dashboardClients: sortedDashboardClients,
        totalCount,
        assignedClients,
        assignedTotalCount,
      };
    } catch (error) {
      console.error('Error preparing dashboard client companies:', error);
      return { dashboardClients: [], totalCount: 0, assignedClients: [], assignedTotalCount: 0 };
    }
  }

  async getDashboardData(userId: number, request?: any) {
    const startTime = Date.now();

    // Validate userId
    if (!userId || isNaN(userId) || userId <= 0) {
      console.error('❌ Invalid user ID in dashboard service:', {
        userId,
        userIdType: typeof userId,
        isNaN: isNaN(userId),
      });
      throw new Error('Invalid user ID provided');
    }

    // Find the akzente record for this user
    const akzente = await this.findByUserId(userId);
    if (!akzente) {
      throw new Error('Akzente profile not found for user');
    }

    const favoriteProjectsPromise = this.akzenteFavoriteProjectService.findByAkzenteId(akzente.id);
    const dashboardPayloadPromise = this.getDashboardClientCompanies(userId);
    const assignedProjectsPromise = this.projectAssignedAkzenteService.findByAkzenteId(akzente.id);

    const [favoriteProjects, dashboardPayload, assignedProjects] = await Promise.all([
      favoriteProjectsPromise,
      dashboardPayloadPromise,
      assignedProjectsPromise,
    ]);

    const favoriteProjectIds = favoriteProjects.map(fav => fav.project.id);
    const assignedProjectIds = assignedProjects
      .map(assignment => assignment?.project?.id)
      .filter((id): id is number => typeof id === 'number');
    const assignedClientIds = (dashboardPayload?.assignedClients || []).map((client: any) => client.id);

    // Collect project IDs for all assigned client companies (ensures we include projects where user is assigned via client relationship only)
    const projectsByAssignedClients = await Promise.all(
      assignedClientIds.map((clientCompanyId: number) => this.projectService.findByClientCompanyId(clientCompanyId)),
    );
    const projectsFromAssignedClients = projectsByAssignedClients.flat();
    const projectIdsFromClients = projectsFromAssignedClients
      .map((project: any) => project?.id)
      .filter((id: any): id is number => typeof id === 'number');

    const projectIds = Array.from(new Set([...favoriteProjectIds, ...assignedProjectIds, ...projectIdsFromClients]));
    let newReportsWithFilteredStatus: any[] = [];
    let rejectedReportsWithFilteredStatus: any[] = [];

    if (projectIds.length > 0) {
      const dashboardReports = await this.reportService.findByProjectIdsAndStatuses(
        projectIds,
        [ReportStatusEnum.PENDING, ReportStatusEnum.SUBMITTED],
      );

      const newReports: any[] = [];
      const rejectedReports: any[] = [];

      dashboardReports.forEach((report) => {
        const statusId = report.status?.id;
        if (statusId === ReportStatusEnum.SUBMITTED) {
          rejectedReports.push(report);
        } else if (statusId === ReportStatusEnum.PENDING) {
          newReports.push(report);
        }
      });

      const [newReportsWithFavorites, rejectedReportsWithFavorites] = await Promise.all([
        this.reportService.addFavoriteStatusToReports(newReports, userId, request),
        this.reportService.addFavoriteStatusToReports(rejectedReports, userId, request),
      ]);

      [newReportsWithFilteredStatus, rejectedReportsWithFilteredStatus] = await Promise.all([
        this.applyStatusFilteringToReports(newReportsWithFavorites, 'akzente'),
        this.applyStatusFilteringToReports(rejectedReportsWithFavorites, 'akzente'),
      ]);

      // Remove conversations from reports for dashboard
      newReportsWithFilteredStatus = newReportsWithFilteredStatus.map(report => {
        const { conversation, ...reportWithoutConversation } = report;
        return reportWithoutConversation;
      });
      rejectedReportsWithFilteredStatus = rejectedReportsWithFilteredStatus.map(report => {
        const { conversation, ...reportWithoutConversation } = report;
        return reportWithoutConversation;
      });
    }

    const processingTimeMs = Date.now() - startTime;

    return {
      newReports: newReportsWithFilteredStatus,
      rejectedReports: rejectedReportsWithFilteredStatus,
      clientCompaniesAssignedAkzente: dashboardPayload.assignedClients,
      totalAssignedClientCompaniesCount: dashboardPayload.assignedTotalCount,
      dashboardClientCompanies: dashboardPayload.dashboardClients,
      totalClientCompaniesCount: dashboardPayload.totalCount,
      processingTimeMs,
    };
  }
}
