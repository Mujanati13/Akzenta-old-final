import {
  forwardRef,
  Inject,
  Injectable,
  Logger,
} from '@nestjs/common';
import { CreateReportDto } from './dto/create-report.dto';
import { ReportRepository } from './infrastructure/persistence/report.repository';
import { ReportStatusEnum } from '../report-status/dto/status.enum';
import {
  categorizeReportCount,
  reportHasVisitDate,
  resolveSetupStatusId,
} from '../report-status/report-status.util';
import { IPaginationOptions } from '../utils/types/pagination-options';
import { Report } from './domain/report';
import { ProjectService } from '../project/project.service';
import { ClientCompanyService } from '../client-company/client-company.service';
import { MerchandiserService } from '../merchandiser/merchandiser.service';
import { BranchService } from '../branch/branch.service';
import { Project } from '../project/domain/project';
import { ClientCompany } from '../client-company/domain/client-company';
import { Merchandiser } from '../merchandiser/domain/merchandiser';
import { Branch } from '../branch/domain/branch';
import { StatusService } from '../report-status/status.service';
import { UpdateReportDto } from './dto/update-cities.dto';
import { ReportStatus } from '../report-status/domain/status';
import { AkzenteFavoriteReportsService } from '../akzente-favorite-reports/akzente-favorite-reports.service';
import { AkzenteService } from '../akzente/akzente.service';
import { ClientService } from '../client/client.service';
import { ClientFavoriteReportsService } from '../client-favorite-reports/client-favorite-reports.service';
import { MerchandiserFavoriteReportsService } from '../merchandiser-favorite-reports/merchandiser-favorite-reports.service';
import { ProjectAssignedAkzenteService } from '../project-assigned-akzente/project-assigned-akzente.service';
import { AdvancedPhotoService } from '../advanced-photo/advanced-photo.service';
import { MailerService } from '../mailer/mailer.service';
import * as XLSX from 'xlsx-js-style';
import * as fs from 'fs';
import * as path from 'path';
import { ConfigService } from '@nestjs/config';
import appConfig from '../config/app.config';
import fileConfig from '../files/config/file.config';
import { FileDriver } from '../files/config/file-config.type';

@Injectable()
export class ReportService {
  constructor(
    @Inject(forwardRef(() => ReportRepository))
    private readonly reportRepository: ReportRepository,
    @Inject(forwardRef(() => ProjectService))
    private readonly projectService: ProjectService,
    @Inject(forwardRef(() => StatusService))
    private readonly statusService: StatusService,
    @Inject(forwardRef(() => ClientCompanyService))
    private readonly clientCompanyService: ClientCompanyService,
    @Inject(forwardRef(() => MerchandiserService))
    private readonly merchandiserService: MerchandiserService,
    @Inject(forwardRef(() => BranchService))
    private readonly branchService: BranchService,
    @Inject(forwardRef(() => AkzenteFavoriteReportsService))
    private readonly akzenteFavoriteReportsService: AkzenteFavoriteReportsService,
    @Inject(forwardRef(() => AkzenteService))
    private readonly akzenteService: AkzenteService,
    @Inject(forwardRef(() => ClientService))
    private readonly clientService: ClientService,
    @Inject(forwardRef(() => ClientFavoriteReportsService))
    private readonly clientFavoriteReportsService: ClientFavoriteReportsService,
    @Inject(forwardRef(() => MerchandiserFavoriteReportsService))
    private readonly merchandiserFavoriteReportsService: MerchandiserFavoriteReportsService,
    @Inject(forwardRef(() => ProjectAssignedAkzenteService))
    private readonly projectAssignedAkzenteService: ProjectAssignedAkzenteService,
    @Inject(forwardRef(() => AdvancedPhotoService))
    private readonly advancedPhotoService: AdvancedPhotoService,
    private readonly mailerService: MailerService,
    private readonly configService: ConfigService,
  ) {}

  private readonly logger = new Logger(ReportService.name);

  async create(createReportDto: CreateReportDto): Promise<Report> {
    const project = await this.projectService.findById(
      createReportDto.project.id,
    );
    if (!project) {
      throw new Error('Project not found');
    }

    const status = await this.statusService.findById(createReportDto.status.id);
    if (!status) {
      throw new Error('Status not found');
    }

    const clientCompany = await this.clientCompanyService.findById(
      createReportDto.clientCompany.id,
    );
    if (!clientCompany) {
      throw new Error('Client company not found');
    }

    const branch = await this.branchService.findById(createReportDto.branch.id);
    if (!branch) {
      throw new Error('Branch not found');
    }

    let merchandiser: Merchandiser | null = null;
    if (createReportDto.merchandiser) {
      const foundMerchandiser = await this.merchandiserService.findById(
        createReportDto.merchandiser.id,
      );
      if (!foundMerchandiser) {
        throw new Error('Merchandiser not found');
      }
      merchandiser = foundMerchandiser;
    }

    const report = await this.reportRepository.create({
      project,
      status,
      clientCompany,
      merchandiser,
      branch,
      street: createReportDto.street,
      zipCode: createReportDto.zipCode,
      plannedOn: createReportDto.plannedOn
        ? new Date(createReportDto.plannedOn)
        : null,
      note: createReportDto.note,
      reportTo: createReportDto.reportTo
        ? new Date(createReportDto.reportTo)
        : null,
      feedback: createReportDto.feedback,
      accepted: false,
    });

    const reportWithFavorite = await this.addFavoriteStatusToReport(report);
    if (!reportWithFavorite) {
      throw new Error('Failed to create report');
    }
    return reportWithFavorite;
  }

  findAllWithPagination({
    paginationOptions,
  }: {
    paginationOptions: IPaginationOptions;
  }) {
    return this.reportRepository.findAllWithPagination({
      paginationOptions: {
        page: paginationOptions.page,
        limit: paginationOptions.limit,
      },
    });
  }

  private dedupeUploadedAdvancedPhotos(report: Report | null): Report | null {
    if (!report || !Array.isArray((report as any).uploadedAdvancedPhotos)) {
      return report;
    }

    const photos = (report as any).uploadedAdvancedPhotos as any[];
    // Oldest row wins for accidental duplicate saves (same label / slot).
    const sorted = [...photos].sort(
      (a, b) => (Number(a?.id) || 0) - (Number(b?.id) || 0),
    );

    const seenRowIds = new Set<number>();
    const seenSlots = new Set<string>();

    (report as any).uploadedAdvancedPhotos = sorted.filter((photo: any) => {
      const rowId = Number(photo?.id);
      if (Number.isFinite(rowId)) {
        if (seenRowIds.has(rowId)) {
          return false;
        }
        seenRowIds.add(rowId);
      }

      const advancedPhotoId = photo?.advancedPhoto?.id ?? '';
      const beforeAfterType = photo?.beforeAfterType ?? '';
      const labelPart = String(photo?.label ?? '').trim();
      // One row per logical upload cell: same advanced photo + side + label (e.g. "Fotos2_3 - …").
      // Using `order` here wrongly kept every duplicate when each save incremented order.
      const slotKey = labelPart
        ? `${advancedPhotoId}|${beforeAfterType}|${labelPart}`
        : `${advancedPhotoId}|${beforeAfterType}|__empty__|${photo?.order ?? 0}`;

      if (seenSlots.has(slotKey)) {
        return false;
      }
      seenSlots.add(slotKey);

      return true;
    });

    return report;
  }

  async findById(id: Report['id'], userId?: number, request?: any) {
    if (!userId) {
      const report = await this.reportRepository.findById(id);
      if (!report) return null;
      const normalizedReport = this.dedupeUploadedAdvancedPhotos(report);
      return this.addFavoriteStatusToReport(normalizedReport, userId, request);
    }

    // Get userType from JWT (fastest - no DB calls)
    const userType = request?.user?.userType;
    
    if (!userType) {
      // Fallback to database calls if JWT doesn't have userType
      return this.findByIdFallback(id, userId);
    }

    const report = await this.reportRepository.findByIdWithFilteredConversation(
      id,
      { role: userType, userId },
    );
    if (!report) return null;
    this.dedupeUploadedAdvancedPhotos(report);

    const reportWithFavorite = await this.addFavoriteStatusToReport(
      report,
      userId,
      request,
    );
    if (!reportWithFavorite) return null;

    return this.filterStatusForUserType(reportWithFavorite, userType);
  }

  /**
   * Optimized version of findById specifically for updates - only loads essential data
   * This method is separate from the main findById to avoid breaking existing functionality
   */
  async findByIdForUpdate(id: Report['id']): Promise<Report | null> {
    const report = await this.reportRepository.findByIdForUpdate(id);
    return report;
  }

  /**
   * Fallback method for when JWT doesn't have userType
   */
  private async findByIdFallback(id: Report['id'], userId: number) {
    const akzenteEntity = await this.akzenteService.findByUserId(userId);
    const clientEntity = await this.clientService.findByUserId(userId);
    let merchandiserEntity: any = null;
    try {
      merchandiserEntity =
        await this.merchandiserService.findByUserIdNumber(userId);
    } catch {}

    let viewerRole: 'akzente' | 'client' | 'merchandiser' = 'akzente';
    if (clientEntity) viewerRole = 'client';
    else if (merchandiserEntity && !akzenteEntity) viewerRole = 'merchandiser';

    const report = await this.reportRepository.findByIdWithFilteredConversation(
      id,
      { role: viewerRole, userId },
    );
    if (!report) return null;
    this.dedupeUploadedAdvancedPhotos(report);

    const reportWithFavorite = await this.addFavoriteStatusToReport(
      report,
      userId,
    );
    if (!reportWithFavorite) return null;

    return this.filterStatusForUserType(reportWithFavorite, viewerRole);
  }

  async findByIds(ids: Report['id'][], userId?: number, request?: any) {
    const reports = await this.reportRepository.findByIds(ids);
    return this.addFavoriteStatusToReports(reports, userId, request);
  }

  async update(
    id: Report['id'],
    updateReportDto: UpdateReportDto,
    userId?: number,
  ) {
    
    // Only fetch entities that are actually being updated
    const fetchPromises: Promise<any>[] = [];
    const entityKeys: string[] = [];

    if (updateReportDto.project) {
      fetchPromises.push(this.projectService.findById(updateReportDto.project.id));
      entityKeys.push('project');
    }

    if (updateReportDto.status) {
      fetchPromises.push(this.statusService.findById(updateReportDto.status.id));
      entityKeys.push('status');
    }

    if (updateReportDto.clientCompany) {
      fetchPromises.push(this.clientCompanyService.findById(updateReportDto.clientCompany.id));
      entityKeys.push('clientCompany');
    }

    const clearMerchandiser =
      'merchandiser' in updateReportDto && updateReportDto.merchandiser === null;
    if (updateReportDto.merchandiser) {
      // Handle different formats: direct ID, object with id property, or nested object
      let merchandiserId: any;
      if (typeof updateReportDto.merchandiser === 'number') {
        merchandiserId = updateReportDto.merchandiser;
      } else if (updateReportDto.merchandiser.id !== undefined) {
        // If id is a number, use it directly; if it's an object, extract the id from it
        if (typeof updateReportDto.merchandiser.id === 'number') {
          merchandiserId = updateReportDto.merchandiser.id;
        } else if (typeof updateReportDto.merchandiser.id === 'object' && updateReportDto.merchandiser.id !== null) {
          // Handle nested object: try id.id or just use the object itself (which might be the ID)
          merchandiserId = (updateReportDto.merchandiser.id as any).id || updateReportDto.merchandiser.id;
        } else {
          merchandiserId = updateReportDto.merchandiser.id;
        }
      } else {
        throw new Error('Invalid merchandiser format: missing id');
      }
      
      // Validate the ID is a number
      const numericId = Number(merchandiserId);
      if (isNaN(numericId) || numericId <= 0) {
        throw new Error(`Invalid merchandiser ID: ${merchandiserId}`);
      }
      
      fetchPromises.push(this.merchandiserService.findById(numericId));
      entityKeys.push('merchandiser');
    }

    if (updateReportDto.branch) {
      fetchPromises.push(this.branchService.findById(updateReportDto.branch.id));
      entityKeys.push('branch');
    }

    // Fetch all entities in parallel
    const fetchedEntities = await Promise.all(fetchPromises);

    // Map results back to variables
    let projectUpdate: Project | undefined = undefined;
    let statusUpdate: ReportStatus | undefined = undefined;
    let clientCompanyUpdate: ClientCompany | undefined = undefined;
    let merchandiserUpdate: Merchandiser | undefined = undefined;
    let branchUpdate: Branch | undefined = undefined;

    entityKeys.forEach((key, index) => {
      const entity = fetchedEntities[index];
      if (!entity) {
        throw new Error(`${key} not found`);
      }
      
      switch (key) {
        case 'project':
          projectUpdate = entity;
          break;
        case 'status':
          statusUpdate = entity;
          break;
        case 'clientCompany':
          clientCompanyUpdate = entity;
          break;
        case 'merchandiser':
          merchandiserUpdate = entity;
          break;
        case 'branch':
          branchUpdate = entity;
          break;
      }
    });

    // Build payload conditionally to avoid unintentionally nulling relations
    // Bidirectional sync: plannedOn and visitDate should always match,
    // but we must also respect explicit nulls (to clear dates) and undefined (no change).
    let plannedOnDate: Date | null | undefined;
    let visitDateValue: Date | null | undefined;

    if ('plannedOn' in updateReportDto) {
      plannedOnDate =
        updateReportDto.plannedOn === null
          ? null
          : updateReportDto.plannedOn
          ? new Date(updateReportDto.plannedOn)
          : null;
    }

    if ('visitDate' in updateReportDto) {
      visitDateValue =
        updateReportDto.visitDate === null
          ? null
          : updateReportDto.visitDate
          ? new Date(updateReportDto.visitDate)
          : null;
    }

    // Determine synced values:
    // - If both defined (including null), keep them as-is
    // - If only one side defined, mirror it to the other side
    let syncedPlannedOn = plannedOnDate;
    let syncedVisitDate = visitDateValue;

    if (plannedOnDate === undefined && visitDateValue !== undefined) {
      syncedPlannedOn = visitDateValue;
    } else if (visitDateValue === undefined && plannedOnDate !== undefined) {
      syncedVisitDate = plannedOnDate;
    }

    const updatePayload: any = {
      street: updateReportDto.street,
      zipCode: updateReportDto.zipCode,
      note: updateReportDto.note,
      feedback: updateReportDto.feedback,
    };

    if ('accepted' in updateReportDto && updateReportDto.accepted !== undefined) {
      updatePayload.accepted = !!updateReportDto.accepted;
    }

    if (syncedPlannedOn !== undefined) {
      updatePayload.plannedOn = syncedPlannedOn;
    }

    if (syncedVisitDate !== undefined) {
      updatePayload.visitDate = syncedVisitDate;
    }

    if ('reportTo' in updateReportDto) {
      updatePayload.reportTo =
        updateReportDto.reportTo === null
          ? null
          : updateReportDto.reportTo
          ? new Date(updateReportDto.reportTo)
          : null;
    }

    if ('nextVisitDate' in updateReportDto) {
      updatePayload.nextVisitDate =
        updateReportDto.nextVisitDate === null
          ? null
          : updateReportDto.nextVisitDate
          ? new Date(updateReportDto.nextVisitDate)
          : null;
    }

    if (projectUpdate !== undefined) {
      updatePayload.project = projectUpdate;
    }
    if (statusUpdate !== undefined) {
      updatePayload.status = statusUpdate;
    }
    if (clientCompanyUpdate !== undefined) {
      updatePayload.clientCompany = clientCompanyUpdate;
    }
    if (clearMerchandiser) {
      updatePayload.merchandiser = null;
    } else if (merchandiserUpdate !== undefined) {
      updatePayload.merchandiser = merchandiserUpdate;
    }
    if (branchUpdate !== undefined) {
      updatePayload.branch = branchUpdate;
    }

    const report = await this.reportRepository.update(id, updatePayload);
    const reportWithFavorite = await this.addFavoriteStatusToReport(
      report,
      userId,
    );
    
    if (!reportWithFavorite) return null;

    return reportWithFavorite;
  }

  remove(id: Report['id']) {
    return this.reportRepository.remove(id);
  }

  async findByProjectId(
    projectId: number,
    userId?: number,
    request?: any,
    options: { detailed?: boolean } = {},
  ): Promise<Report[]> {
    const reports = options.detailed
      ? await this.reportRepository.findByProjectIdWithDetails(projectId)
      : await this.reportRepository.findByProjectId(projectId);
    return this.addFavoriteStatusToReports(reports, userId, request);
  }

  /**
   * Get reports for a project based on user type
   * - Akzente users: Get all reports for the project
   * - Merchandiser users: Get only reports where the merchandiser is assigned
   * Uses JWT userType to avoid database calls for user type determination
   */
  async findByProjectIdForUserType(
    projectId: number,
    userId?: number,
    request?: any,
    options: { detailed?: boolean } = {},
  ): Promise<Report[]> {
    if (!userId) {
      // If no user ID, return all reports (fallback behavior)
      return this.findByProjectId(projectId, userId, request, options);
    }

    try {
      // Get userType from JWT (fastest - no DB calls)
      const userType = request?.user?.userType;
      
      if (!userType) {
        // Fallback to database calls if JWT doesn't have userType
        return this.findByProjectIdForUserTypeFallback(projectId, userId, request, options);
      }

      if (userType === 'merchandiser') {
        // For merchandisers, get only reports where they are assigned
        const merchandiserEntity = await this.merchandiserService.findByUserIdNumber(userId).catch(() => null);
        if (merchandiserEntity) {
          return this.findByProjectIdForMerchandiser(
            projectId,
            merchandiserEntity.id,
            userId,
            request,
            options,
          );
        }
      }
      
      // For Akzente users (or other types), return all reports
      return this.findByProjectId(projectId, userId, request, options);
    } catch (error) {
      console.error(
        '❌ Error getting project reports:',
        error,
      );
      // Fallback to all reports on error
      return this.findByProjectId(projectId, userId, request, options);
    }
  }

  /**
   * Fallback method for when JWT doesn't have userType
   */
  private async findByProjectIdForUserTypeFallback(
    projectId: number,
    userId: number,
    request?: any,
    options: { detailed?: boolean } = {},
  ): Promise<Report[]> {
    // CRITICAL: Validate userId before making database calls
    if (!userId || typeof userId !== 'number' || isNaN(userId) || userId <= 0) {
      console.warn('❌ Invalid userId in findByProjectIdForUserTypeFallback, returning all reports');
      return this.findByProjectId(projectId, userId, request, options);
    }

    try {
      // Determine user type
      const { userType, merchandiserEntity } =
        await this.determineUserTypeAndEntities(userId);

      if (userType === 'merchandiser' && merchandiserEntity) {
        // For merchandisers, get only reports where they are assigned
        return this.findByProjectIdForMerchandiser(
          projectId,
          merchandiserEntity.id,
          userId,
          request,
          options,
        );
      } else {
        // For Akzente users (or other types), return all reports
        return this.findByProjectId(projectId, userId, request, options);
      }
    } catch (error) {
      console.error(
        '❌ Error determining user type for project reports (fallback):',
        error,
      );
      // Fallback to all reports on error
      return this.findByProjectId(projectId, userId, request, options);
    }
  }

  /**
   * Get reports for a project where the merchandiser is assigned
   */
  private async findByProjectIdForMerchandiser(
    projectId: number,
    merchandiserId: number,
    userId: number,
    request?: any,
    options: { detailed?: boolean } = {},
  ): Promise<Report[]> {
    // Get all reports for the project
    const allReports = options.detailed
      ? await this.reportRepository.findByProjectIdWithDetails(projectId)
      : await this.reportRepository.findByProjectId(projectId);

    // Filter reports to only include those where the merchandiser is assigned
    const filteredReports = allReports.filter(
      (report) => report.merchandiser?.id === merchandiserId,
    );

    // Add favorite status to filtered reports
    return this.addFavoriteStatusToReports(filteredReports, userId, request);
  }

  async findByBranchId(
    branchId: number,
    userId?: number,
    request?: any,
  ): Promise<Report[]> {
    const reports = await this.reportRepository.findByBranchId(branchId);
    return this.addFavoriteStatusToReports(reports, userId, request);
  }

  async findByProjectIdsAndStatus(
    projectIds: number[],
    status: number,
  ): Promise<Report[]> {
    if (!projectIds || projectIds.length === 0) {
      return [];
    }

    const reports = await this.reportRepository.findByProjectIdsAndStatus(
      projectIds,
      status,
    );

    return reports;
  }

  async findByProjectIdsAndStatuses(
    projectIds: number[],
    statuses: number[],
  ): Promise<Report[]> {
    if (!projectIds?.length || !statuses?.length) {
      return [];
    }

    return this.reportRepository.findByProjectIdsAndStatuses(projectIds, statuses);
  }

  async findByProjectIds(projectIds: number[]): Promise<Report[]> {
    if (!projectIds || projectIds.length === 0) {
      return [];
    }

    const reports = await this.reportRepository.findByProjectIds(projectIds);

    return reports;
  }

  /**
   * Optimized method to get report counts by status categories for multiple projects
   * This method makes only ONE database query instead of 8 separate queries
   */
  async getReportCountsByStatusCategories(
    projectIds: number[],
    userType: 'akzente' | 'client' | 'merchandiser' = 'akzente',
  ): Promise<
    Map<
      number,
      { newReports: number; ongoingReports: number; completedReports: number }
    >
  > {
    if (!projectIds || projectIds.length === 0) {
      return new Map();
    }

    try {
      // Single database query to get aggregated counts
      const counts = await this.reportRepository.getReportCountsByStatusForProjects(projectIds);

      // Initialize counts map
      const reportCountsMap = new Map<
        number,
        { newReports: number; ongoingReports: number; completedReports: number }
      >();
      projectIds.forEach((projectId) => {
        reportCountsMap.set(projectId, {
          newReports: 0,
          ongoingReports: 0,
          completedReports: 0,
        });
      });

      // Count reports by project and status category
      counts.forEach((item) => {
        const projectId = item.projectId;
        const statusId = item.statusId;
        const count = item.count;
        
        const projectCounts = reportCountsMap.get(projectId);
        if (!projectCounts) return;

        const category = categorizeReportCount(statusId, userType);
        if (category === 'new') {
          projectCounts.newReports += count;
        } else if (category === 'completed') {
          projectCounts.completedReports += count;
        } else if (category === 'ongoing') {
          projectCounts.ongoingReports += count;
        }
      });

      return reportCountsMap;
    } catch (error) {
      console.error('Error getting optimized report counts:', error);
      // Return empty counts if there's an error
      const emptyCountsMap = new Map<
        number,
        { newReports: number; ongoingReports: number; completedReports: number }
      >();
      projectIds.forEach((projectId) => {
        emptyCountsMap.set(projectId, {
          newReports: 0,
          ongoingReports: 0,
          completedReports: 0,
        });
      });
      return emptyCountsMap;
    }
  }

  async getBranchCountsForProjects(projectIds: number[]): Promise<Map<number, number>> {
    if (!projectIds || projectIds.length === 0) {
      return new Map();
    }
    
    try {
      const counts = await this.reportRepository.getBranchCountsForProjects(projectIds);
      const map = new Map<number, number>();
      counts.forEach(c => map.set(c.projectId, c.count));
      return map;
    } catch (error) {
      console.error('Error getting branch counts:', error);
      return new Map();
    }
  }

  async getCompletedBranchCountsForProjects(projectIds: number[]): Promise<Map<number, number>> {
    if (!projectIds || projectIds.length === 0) {
      return new Map();
    }
    
    try {
      const counts = await this.reportRepository.getCompletedBranchCountsForProjects(projectIds);
      const map = new Map<number, number>();
      counts.forEach(c => map.set(c.projectId, c.count));
      return map;
    } catch (error) {
      console.error('Error getting completed branch counts:', error);
      return new Map();
    }
  }

  /**
   * Helper method to add favorite status to reports and filter status
   * Uses JWT userType to avoid database calls for user type determination
   */
  async addFavoriteStatusToReports(
    reports: Report[],
    userId?: number,
    request?: any,
  ): Promise<Report[]> {
    // Early return if userId is invalid - CRITICAL: This must be checked first
    if (!userId || isNaN(userId) || userId <= 0) {
      // If no valid user ID, all reports are not favorited - return immediately
      return reports.map((report) => ({ ...report, isFavorite: false }));
    }

    try {
      // Get userType from JWT (fastest - no DB calls)
      const userType = request?.user?.userType;
      
      if (!userType) {
        // For merchandiser endpoints, skip favorite status to avoid connection pool issues
        // Check if this is a merchandiser request by looking at the request path or user context
        const isMerchandiserRequest = request?.url?.includes('/merchandiser') || 
                                     request?.route?.path?.includes('merchandiser');
        
        if (isMerchandiserRequest) {
          // Merchandisers don't need favorite status for reports
          return reports.map((report) => ({ ...report, isFavorite: false }));
        }
        
        // CRITICAL: Skip fallback to prevent connection pool exhaustion
        // If userType is not available in JWT (e.g. old token), skip favorite status.
        // Re-login to get a token that includes userType.
        this.logger.debug(
          'userType not in JWT, skipping favorite status (re-login to fix)',
        );
        return reports.map((report) => ({ ...report, isFavorite: false }));
        
        // REMOVED: Fallback method that causes connection pool exhaustion
        // The fallback was causing too many concurrent database connections
        // If favorite status is critical, ensure userType is always in JWT
      }

      let reportsWithFavorites: Report[];

      if (userType === 'akzente') {
        // Akzente logic - get entity and favorites
        const akzenteEntity = await this.akzenteService
          .findByUserId(userId)
          .catch(() => null);
        
        if (akzenteEntity) {
          // Optimize: Only fetch favorites for the specific reports being loaded
          const reportIds = reports.map((r) => r.id);
          const favorites = await this.akzenteFavoriteReportsService.findByAkzenteIdAndReportIds(
            akzenteEntity.id,
            reportIds,
          );
          const favoriteReportIds = new Set(favorites.map((fav) => fav.report.id));

          reportsWithFavorites = reports.map((report) => ({
            ...report,
            isFavorite: favoriteReportIds.has(report.id),
          }));
        } else {
          reportsWithFavorites = reports.map((report) => ({
            ...report,
            isFavorite: false,
          }));
        }
      } else if (userType === 'client') {
        // Client logic - get entity and favorites
        const clientEntity = await this.clientService
          .findByUserId(userId)
          .catch(() => null);
        
        if (clientEntity) {
          // Optimize: Only fetch favorites for the specific reports being loaded
          const reportIds = reports.map((r) => r.id);
          const favorites = await this.clientFavoriteReportsService.findByClientIdAndReportIds(
            clientEntity.id,
            reportIds,
          );
          const favoriteReportIds = new Set(favorites.map((fav) => fav.report.id));

          reportsWithFavorites = reports.map((report) => ({
            ...report,
            isFavorite: favoriteReportIds.has(report.id),
          }));
        } else {
          reportsWithFavorites = reports.map((report) => ({
            ...report,
            isFavorite: false,
          }));
        }
      } else {
        // Merchandiser or unknown type - all reports are not favorited
        reportsWithFavorites = reports.map((report) => ({
          ...report,
          isFavorite: false,
        }));
      }

      // Apply status filtering to all reports using JWT userType
      return reportsWithFavorites.map((report) =>
        this.filterStatusForUserType(report, userType),
      );
    } catch (error) {
      // If there's an error, assume all reports are not favorited
      console.error('Error adding favorite status to reports:', error);
      return reports.map((report) => ({ ...report, isFavorite: false }));
    }
  }

  /**
   * Fallback method for when JWT doesn't have userType
   */
  private async addFavoriteStatusToReportsFallback(
    reports: Report[],
    userId?: number,
  ): Promise<Report[]> {
    // CRITICAL: Double-check userId validity before making any database calls
    // Check for undefined, null, NaN, non-number types, and invalid numbers
    if (!userId || typeof userId !== 'number' || isNaN(userId) || userId <= 0) {
      this.logger.warn(
          `Invalid user ID in fallback, skipping favorite status. userId: ${userId} type: ${typeof userId}`,
        );
      // Return immediately without making any database calls
      return reports.map((report) => ({ ...report, isFavorite: false }));
    }

    try {
      // Fallback to DB calls if JWT doesn't have userType
      // But catch connection errors early to prevent pool exhaustion
      // Use a shorter timeout to fail fast and avoid connection pool exhaustion
      // Also add a check to prevent calling determineUserTypeAndEntities if userId is invalid
      const result = await Promise.race([
        this.determineUserTypeAndEntities(userId).catch((error) => {
          // If determineUserTypeAndEntities fails, return default values
          console.error('Error in determineUserTypeAndEntities:', error);
          return {
            userType: 'akzente' as const,
            akzenteEntity: null,
            clientEntity: null,
            merchandiserEntity: null,
          };
        }),
        new Promise<{
          userType: 'akzente' | 'client' | 'merchandiser';
          akzenteEntity: any;
          clientEntity: any;
          merchandiserEntity: any;
        }>((_, reject) => 
          setTimeout(() => reject(new Error('Connection timeout')), 2000) // Reduced from 5000 to 2000ms
        ),
      ]) as {
        userType: 'akzente' | 'client' | 'merchandiser';
        akzenteEntity: any;
        clientEntity: any;
        merchandiserEntity: any;
      };

      const userType = result.userType;
      const akzenteEntity = result.akzenteEntity;
      const clientEntity = result.clientEntity;

      let reportsWithFavorites: Report[];

      if (akzenteEntity) {
        // Akzente logic - only fetch favorites for the specific reports being loaded
        const reportIds = reports.map((r) => r.id);
        const favorites = await this.akzenteFavoriteReportsService.findByAkzenteIdAndReportIds(
          akzenteEntity.id,
          reportIds,
        );
        const favoriteReportIds = new Set(favorites.map((fav) => fav.report.id));

        // Add isFavorite field to each report
        reportsWithFavorites = reports.map((report) => ({
          ...report,
          isFavorite: favoriteReportIds.has(report.id),
        }));
      } else if (clientEntity) {
        // Client logic - only fetch favorites for the specific reports being loaded
        const reportIds = reports.map((r) => r.id);
        const favorites = await this.clientFavoriteReportsService.findByClientIdAndReportIds(
          clientEntity.id,
          reportIds,
        );
        const favoriteReportIds = new Set(favorites.map((fav) => fav.report.id));

        // Add isFavorite field to each report
        reportsWithFavorites = reports.map((report) => ({
          ...report,
          isFavorite: favoriteReportIds.has(report.id),
        }));
      } else {
        // If no entity found, all reports are not favorited
        reportsWithFavorites = reports.map((report) => ({
          ...report,
          isFavorite: false,
        }));
      }

      // Apply status filtering to all reports
      return reportsWithFavorites.map((report) =>
        this.filterStatusForUserType(report, userType),
      );
    } catch (error: any) {
      // If there's an error (including connection pool exhaustion), 
      // assume all reports are not favorited and skip status filtering
      const errorMessage = error?.message || '';
      const errorCode = error?.code || '';
      const isConnectionError = errorCode === '53300' || // PostgreSQL connection pool error
                                errorMessage.includes('too many clients') || 
                                errorMessage.includes('connection slots') ||
                                errorMessage.includes('Connection timeout');
      
      if (isConnectionError) {
        this.logger.warn(
          'Connection pool exhausted or timeout in favorite status fallback, skipping favorite status',
        );
      } else {
        console.error('Error adding favorite status to reports (fallback):', error);
      }
      
      // Return reports without favorite status and without status filtering to avoid more DB calls
      return reports.map((report) => ({ ...report, isFavorite: false }));
    }
  }

  /**
   * Helper method to add favorite status to a single report - ULTRA OPTIMIZED VERSION
   * Uses JWT userType to avoid database calls for user type determination
   */
  async addFavoriteStatusToReport(
    report: Report | null,
    userId?: number,
    request?: any,
  ): Promise<Report | null> {
    if (!report) return null;

    if (!userId) {
      return { ...report, isFavorite: false };
    }

    try {
      // Get userType from JWT (fastest - no DB calls)
      const userType = request?.user?.userType;
      
      if (!userType) {
        // Fallback to database calls if JWT doesn't have userType
        return this.addFavoriteStatusToReportFallback(report, userId);
      }

      // Use JWT userType to get the appropriate entity
      let entity: any = null;
      
      if (userType === 'akzente') {
        entity = await this.akzenteService.findByUserId(userId).catch(() => null);
        if (entity) {
          const existing = await this.akzenteFavoriteReportsService.findOne({
            akzenteId: entity.id,
            reportId: report.id,
          });
          return { ...report, isFavorite: !!existing };
        }
      } else if (userType === 'client') {
        entity = await this.clientService.findByUserId(userId).catch(() => null);
        if (entity) {
          const existing = await this.clientFavoriteReportsService.findOne({
            clientId: entity.id,
            reportId: report.id,
          });
          return { ...report, isFavorite: !!existing };
        }
      } else if (userType === 'merchandiser') {
        entity = await this.merchandiserService.findByUserIdNumber(userId).catch(() => null);
        if (entity) {
          const existing = await this.merchandiserFavoriteReportsService.findOne({
            merchandiserId: entity.id,
            reportId: report.id,
          });
          return { ...report, isFavorite: !!existing };
        }
      }

      // If no entity found, report is not favorited
      return { ...report, isFavorite: false };
    } catch (error) {
      console.error('Error adding favorite status to report:', error);
      return { ...report, isFavorite: false };
    }
  }

  /**
   * Fallback method for when JWT doesn't have userType
   */
  private async addFavoriteStatusToReportFallback(
    report: Report | null,
    userId?: number,
  ): Promise<Report | null> {
    if (!report) return null;

    if (!userId) {
      return { ...report, isFavorite: false };
    }

    try {
      // Use parallel queries to find user type - much faster than sequential
      const [akzenteEntity, clientEntity, merchandiserEntity] = await Promise.all([
        this.akzenteService.findByUserId(userId).catch(() => null),
        this.clientService.findByUserId(userId).catch(() => null),
        this.merchandiserService.findByUserIdNumber(userId).catch(() => null),
      ]);

      if (akzenteEntity) {
        // User is Akzente - check favorite status
        const existing = await this.akzenteFavoriteReportsService.findOne({
          akzenteId: akzenteEntity.id,
          reportId: report.id,
        });
        return { ...report, isFavorite: !!existing };
      }

      if (clientEntity) {
        const existing = await this.clientFavoriteReportsService.findOne({
          clientId: clientEntity.id,
          reportId: report.id,
        });
        return { ...report, isFavorite: !!existing };
      }

      if (merchandiserEntity) {
        const existing = await this.merchandiserFavoriteReportsService.findOne({
          merchandiserId: merchandiserEntity.id,
          reportId: report.id,
        });
        return { ...report, isFavorite: !!existing };
      }

      // If no entity found, report is not favorited
      return { ...report, isFavorite: false };
    } catch (error) {
      console.error('Error adding favorite status to report (fallback):', error);
      return { ...report, isFavorite: false };
    }
  }

  /**
   * Helper method to filter status based on user type
   */
  filterStatusForUserType(
    report: Report,
    userType: 'akzente' | 'client' | 'merchandiser',
  ): Report {
    let filteredReport = report;

    if (report.status) {
      const userSpecificName = this.statusService.getStatusNameForUserType(
        report.status,
        userType,
      );
      const userSpecificColor = this.statusService.getStatusColorForUserType(
        report.status,
        userType,
      );

      filteredReport = {
        ...report,
        status: {
          id: report.status.id,
          name: userSpecificName,
          color: userSpecificColor,
        },
      };
    }

    if (userType === 'client') {
      const { note: _note, merchandiser: _merchandiser, ...clientSafeReport } =
        filteredReport;
      return clientSafeReport as Report;
    }

    return filteredReport;
  }

  /**
   * Optimized method to determine user type from JWT token (no DB calls)
   */
  private getUserTypeFromJWT(
    request: any,
  ): 'akzente' | 'client' | 'merchandiser' {
    // If userType is stored in JWT, use it directly (fastest)
    if (request.user?.userType) {
      return request.user.userType;
    }

    // Fallback to default if not in JWT
    return 'akzente';
  }

  /**
   * Optimized method to determine user type and get entities (fallback for when JWT doesn't have userType)
   */
  async determineUserTypeAndEntities(userId: number): Promise<{
    userType: 'akzente' | 'client' | 'merchandiser';
    akzenteEntity: any;
    clientEntity: any;
    merchandiserEntity: any;
  }> {
    // CRITICAL: Validate userId before making any database calls
    if (!userId || isNaN(userId) || userId <= 0) {
      console.error('❌ determineUserTypeAndEntities called with invalid userId:', userId);
      // Return default values without making database calls
      return {
        userType: 'akzente',
        akzenteEntity: null,
        clientEntity: null,
        merchandiserEntity: null,
      };
    }

    try {
      // Make all calls in parallel for better performance
      // Add individual error handling to prevent one failure from affecting others
      const [akzenteEntity, clientEntity, merchandiserEntity] =
        await Promise.all([
          this.akzenteService.findByUserId(userId).catch((e) => {
            console.error('Error fetching Akzente user:', e);
            return null;
          }),
          this.clientService.findByUserId(userId).catch((e) => {
            console.error('Error fetching Client user:', e);
            return null;
          }),
          this.merchandiserService
            .findByUserId(userId as any)
            .catch((e) => {
              console.error('Error fetching Merchandiser user:', e);
              return null;
            }),
        ]);

      let userType: 'akzente' | 'client' | 'merchandiser' = 'akzente';

      if (akzenteEntity) {
        userType = 'akzente';
      } else if (clientEntity) {
        userType = 'client';
      } else if (merchandiserEntity) {
        userType = 'merchandiser';
      }

      return {
        userType,
        akzenteEntity,
        clientEntity,
        merchandiserEntity,
      };
    } catch (error) {
      console.error('Error determining user type:', error);
      return {
        userType: 'akzente',
        akzenteEntity: null,
        clientEntity: null,
        merchandiserEntity: null,
      };
    }
  }

  /**
   * Helper method to determine user type from userId (kept for backward compatibility)
   */
  private async getUserType(
    userId: number,
  ): Promise<'akzente' | 'client' | 'merchandiser'> {
    const { userType } = await this.determineUserTypeAndEntities(userId);
    return userType;
  }

  /**
   * Accept or reject a report by a merchandiser
   */
  async acceptRejectReport(reportId: number, accept: boolean, merchandiserId: number): Promise<Report | null> {

    // Get the report with full details
    const report = await this.reportRepository.findById(reportId);
    if (!report) {
      throw new Error('Report not found');
    }

    // Verify this report is assigned to this merchandiser
    if (!report.merchandiser || report.merchandiser.id !== merchandiserId) {
      throw new Error('This report is not assigned to this merchandiser');
    }

    // Get merchandiser details for email
    const merchandiser = await this.merchandiserService.findById(merchandiserId);
    if (!merchandiser) {
      throw new Error('Merchandiser not found');
    }

    // Update the report
    const updateData: any = {
      accepted: accept,
    };

    // If accepting, move to scheduled when visit date is set, otherwise pending
    if (accept) {
      const hasDate = reportHasVisitDate(report);
      updateData.status = {
        id: resolveSetupStatusId(true, hasDate),
      };
    } else {
      // If rejecting, remove merchandiser assignment and set status back to pending
      updateData.merchandiser = null;
      updateData.status = { id: ReportStatusEnum.PENDING };

      // Send email notification to Akzente staff assigned to the project
      try {
        await this.sendRejectionEmailToAkzente(report, merchandiser);
      } catch (emailError) {
        console.error('⚠️ Failed to send rejection email:', emailError);
        // Don't fail the entire operation if email fails
      }
    }
    await this.reportRepository.update(reportId, updateData);
    return this.findById(reportId);
  }

  /**
   * Send email to Akzente staff when a merchandiser rejects a report
   */
  private async sendRejectionEmailToAkzente(report: Report, merchandiser: Merchandiser): Promise<void> {
    if (!report.project || !report.project.id) {
      console.warn('⚠️ Report has no associated project, cannot send rejection email');
      return;
    }

    // Get Akzente staff assigned to this project
    const projectAssignments = await this.projectAssignedAkzenteService.findByProjectId(report.project.id);
    
    if (!projectAssignments || projectAssignments.length === 0) {
      console.warn('⚠️ No Akzente staff assigned to project, cannot send rejection email');
      return;
    }

    // Get merchandiser name
    const merchandiserName = merchandiser.user 
      ? `${merchandiser.user.firstName || ''} ${merchandiser.user.lastName || ''}`.trim()
      : 'Unbekannter Merchandiser';

    // Prepare email content
    const subject = `Auftrag abgelehnt - ${report.project.name || 'Projekt'}`;
    const emailBody = `
      <h2>Auftrag wurde abgelehnt</h2>
      <p>Der Merchandiser <strong>${merchandiserName}</strong> hat den folgenden Auftrag abgelehnt:</p>
      
      <ul>
        <li><strong>Projekt:</strong> ${report.project.name || 'N/A'}</li>
        <li><strong>Filiale:</strong> ${report.branch?.name || 'N/A'}</li>
        <li><strong>Adresse:</strong> ${report.street || ''} ${report.zipCode || ''}</li>
        <li><strong>Geplant am:</strong> ${report.plannedOn ? new Date(report.plannedOn).toLocaleDateString('de-DE') : 'N/A'}</li>
      </ul>
      
      <p>Der Report wurde auf den Status "NEU" zurückgesetzt und der Merchandiser wurde entfernt.</p>
      <p>Bitte weisen Sie den Report einem anderen Merchandiser zu.</p>
    `;

    const emailBodyText = `
Auftrag wurde abgelehnt

Der Merchandiser ${merchandiserName} hat den folgenden Auftrag abgelehnt:

- Projekt: ${report.project.name || 'N/A'}
- Report ID: ${report.id}
- Filiale: ${report.branch?.name || 'N/A'}
- Adresse: ${report.street || ''} ${report.zipCode || ''}
- Geplant am: ${report.plannedOn ? new Date(report.plannedOn).toLocaleDateString('de-DE') : 'N/A'}

Der Report wurde auf den Status "NEU" zurückgesetzt und der Merchandiser wurde entfernt.
Bitte weisen Sie den Report einem anderen Merchandiser zu.
    `;

    // Send email to all assigned Akzente staff
    const emailPromises = projectAssignments.map(async (assignment) => {
      if (!assignment.akzente?.user?.email) {
        console.warn('⚠️ Akzente staff has no email address, skipping');
        return;
      }

      try {
        await this.mailerService.sendMail({
          to: assignment.akzente.user.email,
          subject: subject,
          text: emailBodyText,
          html: emailBody,
        });
      } catch (error) {
        console.error(`❌ Failed to send email to ${assignment.akzente.user.email}:`, error);
        // Continue with other emails even if one fails
      }
    });

    await Promise.allSettled(emailPromises);
  }

  /**
   * Send assignment email to the newly assigned merchandiser.
   */
  async sendAssignmentEmailToMerchandiser(
    report: Report,
    merchandiser: Merchandiser,
  ): Promise<void> {
    const merchUser = merchandiser?.user;
    if (!merchUser?.email) {
      return;
    }

    const merchandiserName = `${merchUser.firstName || ''} ${merchUser.lastName || ''}`.trim();
    const projectName = report.project?.name || 'Projekt';
    const branchName = report.branch?.name || 'N/A';
    const address = `${report.street || ''} ${report.zipCode || ''}`.trim() || 'N/A';

    const subject = `Neuer Einsatz zugewiesen - ${projectName}`;
    const emailBody = `
      <h2>Neuer Einsatz wurde Ihnen zugewiesen</h2>
      <p>Hallo ${merchandiserName || 'Merchandiser'},</p>
      <p>Sie wurden einem neuen Report zugewiesen.</p>
      <ul>
        <li><strong>Projekt:</strong> ${projectName}</li>
        <li><strong>Filiale:</strong> ${branchName}</li>
        <li><strong>Adresse:</strong> ${address}</li>
        <li><strong>Geplant am:</strong> ${report.plannedOn ? new Date(report.plannedOn).toLocaleDateString('de-DE') : 'N/A'}</li>
      </ul>
      <p>Bitte öffnen Sie die Anfrage und entscheiden Sie, ob Sie den Report annehmen oder ablehnen.</p>
    `;

    const emailBodyText = `
Neuer Einsatz wurde Ihnen zugewiesen

Hallo ${merchandiserName || 'Merchandiser'},

Sie wurden einem neuen Report zugewiesen.
- Projekt: ${projectName}
- Report ID: ${report.id}
- Filiale: ${branchName}
- Adresse: ${address}
- Geplant am: ${report.plannedOn ? new Date(report.plannedOn).toLocaleDateString('de-DE') : 'N/A'}

Bitte öffnen Sie die Anfrage und entscheiden Sie, ob Sie den Report annehmen oder ablehnen.
    `;

    await this.mailerService.sendMail({
      to: merchUser.email,
      subject,
      text: emailBodyText,
      html: emailBody,
    });
  }

  async findByMerchandiserId(merchandiserId: number, userId?: number): Promise<Report[]> {
    const reports =
      await this.reportRepository.findByMerchandiserId(merchandiserId);

    // CRITICAL: Validate userId before making any database calls
    if (!userId || typeof userId !== 'number' || isNaN(userId) || userId <= 0) {
      // If no valid user ID, return reports without favorite status
      // This is safe for merchandiser requests as they don't need favorite status
      return reports.map((report) => ({ ...report, isFavorite: false }));
    }

    // For merchandiser requests, skip favorite status to avoid connection pool exhaustion
    // Merchandisers don't have favorite reports in the same way as Akzente/Client users
    // Return reports without favorite status and without status filtering
    return reports.map((report) => ({ ...report, isFavorite: false }));
  }

  /**
   * Optimized method for dashboard - only loads essential fields and adds favorites efficiently
   */
  async findDashboardReportsByMerchandiserId(
    merchandiserId: number,
  ): Promise<Report[]> {
    const reports = await this.reportRepository.findDashboardReportsByMerchandiserId(merchandiserId);
    return reports.map((report) => ({ ...report, isFavorite: false }));
  }

  /**
   * Get unique client companies associated with a merchandiser through their reports
   */
  async getClientCompaniesByMerchandiserId(
    merchandiserId: number,
  ): Promise<number[]> {
    const reports =
      await this.reportRepository.findByMerchandiserId(merchandiserId);

    // Extract unique client company IDs
    // Handle cases where clientCompany might be null/undefined
    // Try report.clientCompany first, then fall back to report.project?.clientCompany
    const clientCompanyIds = new Set<number>();
    
    reports.forEach((report) => {
      // Try direct clientCompany first
      if (report.clientCompany?.id) {
        clientCompanyIds.add(report.clientCompany.id);
      }
      // Fall back to project's clientCompany if direct one doesn't exist
      else if (report.project?.clientCompany?.id) {
        clientCompanyIds.add(report.project.clientCompany.id);
      }
    });

    return Array.from(clientCompanyIds);
  }

  private buildOrderedExportQuestions(
    reports: Report[],
  ): Array<{
    id: number;
    questionText: string;
    answerType?: { name: string };
    options?: { optionText: string }[];
  }> {
    const questionMap = new Map<
      number,
      {
        id: number;
        questionText: string;
        answerType?: { name: string };
        options?: { optionText: string }[];
      }
    >();

    if (reports.length > 0 && reports[0].project?.questions?.length) {
      for (const question of reports[0].project.questions) {
        questionMap.set(question.id, {
          id: question.id,
          questionText: question.questionText,
          answerType: question.answerType,
          options: question.options,
        });
      }
      return Array.from(questionMap.values());
    }

    const orderedIds: number[] = [];
    reports.forEach((report) => {
      report.answers?.forEach((answer) => {
        if (answer.question?.id && !questionMap.has(answer.question.id)) {
          questionMap.set(answer.question.id, {
            id: answer.question.id,
            questionText: answer.question.questionText,
            answerType: answer.question.answerType,
            options: answer.question.options,
          });
          orderedIds.push(answer.question.id);
        }
      });
    });

    return orderedIds.map((id) => questionMap.get(id)!);
  }

  private buildQuestionHeader(
    question: {
      questionText: string;
      answerType?: { name: string };
      options?: { optionText: string }[];
    },
    questionNumber: number,
  ): string {
    const answerType = question.answerType?.name?.toLowerCase().trim() || '';
    let optionsText = '';

    if (answerType === 'boolean') {
      optionsText = '\n1. JA\n2. NEIN';
    } else if (
      answerType === 'select' ||
      answerType === 'multiple choice' ||
      answerType === 'multiselect'
    ) {
      const visibleOptions = (question.options || [])
        .map((option) => option.optionText?.trim())
        .filter((text) => !!text);

      if (visibleOptions.length > 0) {
        optionsText =
          '\n' +
          visibleOptions
            .map((text, optionIndex) => `${optionIndex + 1}. ${text}`)
            .join('\n');
      }
    }

    return `FRAGE ${questionNumber}:\n"${question.questionText}${optionsText}"`;
  }

  private formatFeedbackForExport(
    feedback: string | boolean | null | undefined,
  ): string {
    if (feedback === true || feedback === 'true' || feedback === '1') {
      return 'Ja';
    }
    if (feedback === false || feedback === 'false' || feedback === '0') {
      return 'Nein';
    }
    if (typeof feedback === 'string') {
      const normalized = feedback.trim().toLowerCase();
      if (normalized === 'ja') return 'Ja';
      if (normalized === 'nein') return 'Nein';
    }
    return '';
  }

  private formatAnswerForExport(
    answers: Array<{
      textAnswer?: string | null;
      selectedOption?: { optionText: string } | null;
    }>,
    answerType: string,
  ): string {
    if (!answers.length) {
      return '';
    }

    const normalizedType = answerType.toLowerCase().trim();

    if (normalizedType === 'boolean') {
      const answer = answers[0];
      if (answer.selectedOption?.optionText) {
        const optionText = answer.selectedOption.optionText.toLowerCase();
        if (optionText.includes('ja') || optionText === 'yes') return 'Ja';
        if (optionText.includes('nein') || optionText === 'no') return 'Nein';
        return answer.selectedOption.optionText;
      }
      if (answer.textAnswer) {
        const textAnswer = answer.textAnswer.toLowerCase();
        if (textAnswer === 'true' || textAnswer === 'ja') return 'Ja';
        if (textAnswer === 'false' || textAnswer === 'nein') return 'Nein';
        return answer.textAnswer;
      }
      return '';
    }

    if (
      normalizedType === 'multiselect' ||
      normalizedType === 'multiple choice'
    ) {
      return answers
        .map((answer) => answer.selectedOption?.optionText)
        .filter((optionText): optionText is string => !!optionText)
        .join(', ');
    }

    const answer = answers[0];
    if (answer.textAnswer) {
      return answer.textAnswer;
    }
    if (answer.selectedOption?.optionText) {
      return answer.selectedOption.optionText;
    }
    return '';
  }

  /**
   * Generate Excel export for project reports with files and photos
   */
  async generateExcelExport(
    reports: Report[],
    options: { excludeConfidentialFields?: boolean } = {},
  ): Promise<Buffer> {
    const excludeConfidentialFields = options.excludeConfidentialFields ?? false;
    // Check if there are any reports to export
    // if (!reports || reports.length === 0) {
    //   throw new Error('Keine Daten in diesem Projekt vorhanden.');
    // }

    const STATIC_COLUMN_COUNT = excludeConfidentialFields ? 10 : 12;

    // Create workbook and worksheet
    const workbook = XLSX.utils.book_new();

    const orderedQuestions = this.buildOrderedExportQuestions(reports);
    const questionHeaders = orderedQuestions.map((question, index) =>
      this.buildQuestionHeader(question, index + 1),
    );
    
    // 1. Initialize Schema
    const apSchema = new Map<number, string[]>(); // apId -> labels
    const apConfig = new Map<number, { isBeforeAfter: boolean }>(); // apId -> config
    const sortedApIds: number[] = [];

    // Load from Project Config
    if (reports.length > 0 && reports[0].project?.id) {
        try {
            const projectAdvancedPhotos = await this.advancedPhotoService.findByProjectId(reports[0].project.id);
            if (projectAdvancedPhotos) {
                projectAdvancedPhotos.sort((a, b) => a.id - b.id);
                projectAdvancedPhotos.forEach(ap => {
                    const trimmedLabels = (ap.labels || []).map(l => l ? l.trim() : '').filter(l => l !== '');
                    apSchema.set(ap.id, trimmedLabels);
                    apConfig.set(ap.id, { isBeforeAfter: !!ap.isBeforeAfter });
                    sortedApIds.push(ap.id);
                });
            }
        } catch (error) {
            console.error('Error fetching project advanced photos:', error);
        }
    }

    let maxUnlabeledBefore = 0;
    let maxUnlabeledAfter = 0;

    reports.forEach((report) => {
      if (report.uploadedAdvancedPhotos) {
        const unlabeled = report.uploadedAdvancedPhotos.filter(p => !p.label || p.label.trim() === '');
        const beforeCount = unlabeled.filter(p => p.beforeAfterType === 'before').length;
        const afterCount = unlabeled.filter(p => p.beforeAfterType === 'after').length;
        
        if (beforeCount > maxUnlabeledBefore) maxUnlabeledBefore = beforeCount;
        if (afterCount > maxUnlabeledAfter) maxUnlabeledAfter = afterCount;

        // Count label occurrences in this report per AP
        const reportPhotos = new Map<string, { apId: number, label: string, before: number, after: number, isBeforeAfter: boolean }>();
        
        report.uploadedAdvancedPhotos.forEach((photo) => {
            if (photo.label && photo.label.trim() !== '' && photo.advancedPhoto) {
                const trimmedLabel = photo.label.trim();
                const apId = photo.advancedPhoto.id;
                
                // Ensure AP is in config
                if (!apConfig.has(apId)) {
                    apConfig.set(apId, { isBeforeAfter: !!photo.advancedPhoto.isBeforeAfter });
                    apSchema.set(apId, []);
                    sortedApIds.push(apId);
                }

                const key = `${apId}_${trimmedLabel}`;
                
                if (!reportPhotos.has(key)) {
                    reportPhotos.set(key, { 
                        apId, 
                        label: trimmedLabel, 
                        before: 0, 
                        after: 0, 
                        isBeforeAfter: !!apConfig.get(apId)!.isBeforeAfter 
                    });
                }
                
                const entry = reportPhotos.get(key)!;
                if (photo.beforeAfterType === 'before') entry.before++;
                else if (photo.beforeAfterType === 'after') entry.after++;
                else {
                    // If type is missing, treat as generic count (add to before for simplicity in sum)
                    entry.before++;
                }
            }
        });

        // Update Schema based on counts
        reportPhotos.forEach((counts) => {
            let neededSlots = 0;
            if (counts.isBeforeAfter) {
                neededSlots = Math.max(counts.before, counts.after);
            } else {
                neededSlots = counts.before + counts.after;
            }
            
            const currentLabels = apSchema.get(counts.apId)!;
            const existingSlots = currentLabels.filter(l => l === counts.label).length;
            
            if (neededSlots > existingSlots) {
                const toAdd = neededSlots - existingSlots;
                for(let i=0; i<toAdd; i++) {
                    currentLabels.push(counts.label);
                }
            }
        });
      }
    });

    // 3. Build definedLabels
    const definedLabels: { label: string, isBeforeAfter: boolean, advancedPhotoId: number }[] = [];
    
    for (const apId of sortedApIds) {
        const labels = apSchema.get(apId)!;
        const config = apConfig.get(apId)!;
        
        for (const label of labels) {
            definedLabels.push({
                label,
                isBeforeAfter: config.isBeforeAfter,
                advancedPhotoId: apId
            });
        }
    }
    
    // Actually, we should iterate definedLabels to generate columns, because it preserves the grouping.
    // But wait, sortedPhotoLabels was used as a list of strings. 
    // If definedLabels has duplicates (e.g. foto2-Tür twice), mapping to strings will have duplicates.
    // The existing code iterates sortedPhotoLabels.
    // We need to update the iteration logic to use definedLabels.

    // Prepare data for Excel export
    const excelData = reports.map((report) => {
      // Get merchandiser name
      const merchandiserName = report.merchandiser?.user
        ? `${report.merchandiser.user.firstName || ''} ${report.merchandiser.user.lastName || ''}`.trim()
        : '';

      const branchNumber = report.branch?.branchNumber
        ? report.branch.branchNumber.toString().trim()
        : '';
      const branchName = report.branch?.name ? report.branch.name.trim() : '';
      const street = (report.street || report.branch?.street || '').trim();
      const zipCode = (report.zipCode || report.branch?.zipCode || '').trim();
      const cityName = (report.branch?.city?.name || '').trim();
      const countryName =
        report.branch?.city?.country?.name?.de ||
        report.branch?.city?.country?.name ||
        'Deutschland';
      const branchPhone = (report.branch?.phone || '').trim();

      // Create row data with static columns + dynamic questions
      const rowData: any = {
        FILIALNUMMER: branchNumber,
        'FILIALE\n(Text)': branchName,
        'STRABE +\nHAUSNUM\nMER': street,
        PLZ: zipCode,
        ORT: cityName,
        LAND: countryName,
        'TELEFON\nFILIALE\n(Text)': branchPhone,
        ...(excludeConfidentialFields
          ? {}
          : {
              'NOTIZ\n(Text)': report.note || '',
              'MERCHANDISER\n(Text)': merchandiserName,
            }),
        BESUCHSDATUM: report.plannedOn
          ? new Date(report.plannedOn).toLocaleDateString('de-DE')
          : '',
        'Report bis': report.reportTo
          ? new Date(report.reportTo).toLocaleDateString('de-DE')
          : '',
        'Feedback\n1. JA\n2. NEIN': this.formatFeedbackForExport(report.feedback),
      };

      // Add dynamic question columns with formatted headers
      orderedQuestions.forEach((question, index) => {
        const headerText = questionHeaders[index];
        const questionAnswers = (report.answers || []).filter(
          (answer) => answer.question?.id === question.id,
        );
        const answerType = question.answerType?.name || '';
        rowData[headerText] = this.formatAnswerForExport(
          questionAnswers,
          answerType,
        );
      });

      // Separate photos into Labeled and Unlabeled
      const allPhotos = report.uploadedAdvancedPhotos || [];
      const unlabeledPhotos = allPhotos.filter(p => !p.label || p.label.trim() === '');
      const labeledPhotos = allPhotos.filter(p => p.label && p.label.trim() !== '');

      // Unlabeled Photos (Standard)
      const unlabeledBefore = unlabeledPhotos.filter(p => p.beforeAfterType === 'before');
      const unlabeledAfter = unlabeledPhotos.filter(p => p.beforeAfterType === 'after');

      // FOTO VORHER columns (dynamic)
      for (let i = 1; i <= maxUnlabeledBefore; i++) {
        const photo = unlabeledBefore[i - 1];
        const url = photo?.file?.path ? this.formatFileUrl(photo.file.path) : '';
        rowData[`FOTO\nVORHER\n${i}`] = url;
      }

      // FOTO NACHHER columns (dynamic)
      for (let i = 1; i <= maxUnlabeledAfter; i++) {
        const photo = unlabeledAfter[i - 1];
        const url = photo?.file?.path ? this.formatFileUrl(photo.file.path) : '';
        rowData[`FOTO\nNACHHER\n${i}`] = url;
      }

      // Labeled Photos (Dynamic)
      const usedPhotoIds = new Set<number>();
      const labelCounters = new Map<string, number>();
      
      definedLabels.forEach(def => {
          const label = def.label;
          const isBeforeAfter = def.isBeforeAfter;
          const apId = def.advancedPhotoId;
          
          // Use split label for header to match UI grouping
          const headerLabel = label.split(',')[0].trim();
          
          let count = labelCounters.get(headerLabel) || 0;
          count++;
          labelCounters.set(headerLabel, count);
          
          // Unique suffix if count > 1
          const suffix = count > 1 ? ` ${count}` : '';
          
          // Find photos for this label and AP (using original label)
          const photosForLabel = labeledPhotos.filter(p => 
              p.label?.trim() === label && 
              p.advancedPhoto?.id === apId && 
              !usedPhotoIds.has(p.id)
          );
          
          if (isBeforeAfter) {
              const beforePhoto = photosForLabel.find(p => p.beforeAfterType === 'before');
              const afterPhoto = photosForLabel.find(p => p.beforeAfterType === 'after');
              
              if (beforePhoto) usedPhotoIds.add(beforePhoto.id);
              if (afterPhoto) usedPhotoIds.add(afterPhoto.id);
              
              rowData[`${headerLabel}${suffix}\n(Vorher)`] = beforePhoto?.file?.path ? this.formatFileUrl(beforePhoto.file.path) : '';
              rowData[`${headerLabel}${suffix}\n(Nachher)`] = afterPhoto?.file?.path ? this.formatFileUrl(afterPhoto.file.path) : '';
          } else {
              const photo = photosForLabel.length > 0 ? photosForLabel[0] : null;
              if (photo) usedPhotoIds.add(photo.id);
              
              rowData[`${headerLabel}${suffix}`] = photo?.file?.path ? this.formatFileUrl(photo.file.path) : '';
          }
      });

      return rowData;
    });

    // Create worksheet from data
    let worksheet;
    if (excelData.length === 0) {
        const staticHeaders = [
            'FILIALNUMMER',
            'FILIALE\n(Text)',
            'STRABE +\nHAUSNUM\nMER',
            'PLZ',
            'ORT',
            'LAND',
            'TELEFON\nFILIALE\n(Text)',
            ...(excludeConfidentialFields
              ? []
              : ['NOTIZ\n(Text)', 'MERCHANDISER\n(Text)']),
            'BESUCHSDATUM',
            'Report bis',
            'Feedback\n1. JA\n2. NEIN',
        ];
        worksheet = XLSX.utils.json_to_sheet([], { header: staticHeaders });
    } else {
        worksheet = XLSX.utils.json_to_sheet(excelData);
    }

    // Set column widths for static + dynamic format
    const columnWidths = [
      { wch: 15 }, // FILIALNUMMER
      { wch: 20 }, // FILIALE
      { wch: 25 }, // STRABE + HAUSNUM MER
      { wch: 8 }, // PLZ
      { wch: 15 }, // ORT
      { wch: 12 }, // LAND
      { wch: 15 }, // TELEFON FILIALE
      ...(excludeConfidentialFields
        ? []
        : [{ wch: 30 }, { wch: 20 }]), // NOTIZ, MERCHANDISER
      { wch: 12 }, // BESUCHSDATUM
      { wch: 12 }, // Report bis
      { wch: 18 }, // Feedback
    ];

    // Add dynamic column widths for questions (first)
    orderedQuestions.forEach(() => {
      columnWidths.push({ wch: 30 }); // Default width for question columns
    });

    // Add photo column widths (after questions)
    for (let i = 1; i <= maxUnlabeledBefore; i++) {
        columnWidths.push({ wch: 20 }); // FOTO VORHER
    }
    for (let i = 1; i <= maxUnlabeledAfter; i++) {
        columnWidths.push({ wch: 20 }); // FOTO NACHHER
    }
    
    // Add widths for dynamic photo columns
    const widthLabelCounters = new Map<string, number>();
    definedLabels.forEach((def) => {
        const label = def.label;
        const isBeforeAfter = def.isBeforeAfter;
        
        // We don't need to track counters here for width, just push the widths
        if (isBeforeAfter) {
            columnWidths.push({ wch: 25 }); // Vorher
            columnWidths.push({ wch: 25 }); // Nachher
        } else {
            columnWidths.push({ wch: 25 }); // Single column
        }
    });

    worksheet['!cols'] = columnWidths;

    // Add photos to Excel cells and create hyperlinks
    await this.addPhotosToWorksheet(
      worksheet,
      reports,
      STATIC_COLUMN_COUNT,
      orderedQuestions.length,
      definedLabels,
      maxUnlabeledBefore,
      maxUnlabeledAfter
    );
    this.addHyperlinksToPhotoCells(
      worksheet,
      reports,
      orderedQuestions.length,
      STATIC_COLUMN_COUNT,
      definedLabels,
      maxUnlabeledBefore,
      maxUnlabeledAfter
    );

    // Get the range of the worksheet
    const range = XLSX.utils.decode_range(worksheet['!ref'] || 'A1');

    // Style the header row (row 0) with full styling support
    for (let col = range.s.c; col <= range.e.c; col++) {
      const cellAddress = XLSX.utils.encode_cell({ r: 0, c: col });
      if (!worksheet[cellAddress]) continue;

      // Set header cell styling with xlsx-js-style
      worksheet[cellAddress].s = {
        fill: {
          patternType: 'solid',
          fgColor: { rgb: 'C0C0C0' }, // Silver gray background
          bgColor: { rgb: 'C0C0C0' },
        },
        font: {
          bold: true,
          sz: 10,
          color: { rgb: '000000' }, // Black text
          name: 'Calibri',
        },
        alignment: {
          horizontal: 'center',
          vertical: 'top',
          wrapText: true,
        },
      };
    }

    // Set row height for header row - much taller
    worksheet['!rows'] = [
      { hpt: 100 }, // Header row height increased to 60 points
      ...Array(range.e.r).fill({ hpt: 120 }), // Data rows height
    ];

    // Add worksheet to workbook
    XLSX.utils.book_append_sheet(workbook, worksheet, 'Reports Export');

    // Generate Excel buffer with styling
    const excelBuffer = XLSX.write(workbook, {
      type: 'buffer',
      bookType: 'xlsx',
      compression: true,
    });

    return excelBuffer;
  }

  /**
   * Add photos to Excel worksheet cells with new structured format
   */
  private async addPhotosToWorksheet(
    worksheet: any,
    reports: Report[],
    staticColumnCount: number,
    questionCount: number,
    definedLabels: { label: string, isBeforeAfter: boolean, advancedPhotoId: number }[],
    maxUnlabeledBefore: number,
    maxUnlabeledAfter: number
  ): Promise<void> {
    try {
      // Map column headers to indices
      const colMap = new Map<string, number>();
      const range = XLSX.utils.decode_range(worksheet['!ref'] || 'A1');
      
      for (let c = range.s.c; c <= range.e.c; ++c) {
          const cell = worksheet[XLSX.utils.encode_cell({ r: 0, c: c })];
          if (cell && cell.v) {
              colMap.set(cell.v, c);
          }
      }

      // Process each report row
      for (let rowIndex = 0; rowIndex < reports.length; rowIndex++) {
        const report = reports[rowIndex];
        const excelRowIndex = rowIndex + 2; // +2 because Excel is 1-indexed and we have headers

        // Separate photos by type
        const allPhotos = report.uploadedAdvancedPhotos || [];
        const unlabeledPhotos = allPhotos.filter(p => !p.label || p.label.trim() === '');
        const labeledPhotos = allPhotos.filter(p => p.label && p.label.trim() !== '');

        const unlabeledBefore = unlabeledPhotos.filter(p => p.beforeAfterType === 'before');
        const unlabeledAfter = unlabeledPhotos.filter(p => p.beforeAfterType === 'after');

        // Add FOTO VORHER photos (dynamic)
        for (let i = 1; i <= maxUnlabeledBefore; i++) {
          const colName = `FOTO\nVORHER\n${i}`;
          if (colMap.has(colName) && unlabeledBefore[i-1]) {
             await this.addPhotoToCell(worksheet, unlabeledBefore[i-1], excelRowIndex, colMap.get(colName)!);
          }
        }

        // Add FOTO NACHHER photos (dynamic)
        for (let i = 1; i <= maxUnlabeledAfter; i++) {
          const colName = `FOTO\nNACHHER\n${i}`;
          if (colMap.has(colName) && unlabeledAfter[i-1]) {
             await this.addPhotoToCell(worksheet, unlabeledAfter[i-1], excelRowIndex, colMap.get(colName)!);
          }
        }

        // Add Labeled Photos
        const usedPhotoIds = new Set<number>();
        const labelCounters = new Map<string, number>();

        for (const def of definedLabels) {
            const label = def.label;
            const isBeforeAfter = def.isBeforeAfter;
            const apId = def.advancedPhotoId;
            
            const headerLabel = label.split(',')[0].trim();
            
            let count = labelCounters.get(headerLabel) || 0;
            count++;
            labelCounters.set(headerLabel, count);
            const suffix = count > 1 ? ` ${count}` : '';

            const photosForLabel = labeledPhotos.filter(p => 
                p.label?.trim() === label && 
                p.advancedPhoto?.id === apId && 
                !usedPhotoIds.has(p.id)
            );
            
            if (isBeforeAfter) {
                const beforePhoto = photosForLabel.find(p => p.beforeAfterType === 'before');
                const afterPhoto = photosForLabel.find(p => p.beforeAfterType === 'after');
                
                if (beforePhoto) usedPhotoIds.add(beforePhoto.id);
                if (afterPhoto) usedPhotoIds.add(afterPhoto.id);
                
                const beforeColName = `${headerLabel}${suffix}\n(Vorher)`;
                const afterColName = `${headerLabel}${suffix}\n(Nachher)`;
                
                if (beforePhoto && colMap.has(beforeColName)) {
                    await this.addPhotoToCell(worksheet, beforePhoto, excelRowIndex, colMap.get(beforeColName)!);
                }
                
                if (afterPhoto && colMap.has(afterColName)) {
                    await this.addPhotoToCell(worksheet, afterPhoto, excelRowIndex, colMap.get(afterColName)!);
                }
            } else {
                const photo = photosForLabel.length > 0 ? photosForLabel[0] : null;
                if (photo) usedPhotoIds.add(photo.id);
                
                const colName = `${headerLabel}${suffix}`;
                if (photo && colMap.has(colName)) {
                    await this.addPhotoToCell(worksheet, photo, excelRowIndex, colMap.get(colName)!);
                }
            }
        }
      }
    } catch (error) {
      console.error('❌ Error adding photos to worksheet:', error);
      // Continue without photos if there's an error
    }
  }

  /**
   * Add a single photo to a specific Excel cell
   */
  private async addPhotoToCell(
    worksheet: any,
    uploadedPhoto: any,
    rowIndex: number,
    colIndex: number,
  ): Promise<void> {
    try {
      if (!uploadedPhoto?.file?.path) {
        return;
      }

      const filePath = uploadedPhoto.file.path;

      // Convert URL back to local file path if it's a URL
      let localFilePath = filePath;
      if (filePath.startsWith('http')) {
        // Extract the path from URL (remove domain and API prefix)
        const urlParts = filePath.split('/');
        const uploadsIndex = urlParts.findIndex((part) => part === 'uploads');
        if (uploadsIndex !== -1) {
          localFilePath = path.join(
            process.cwd(),
            urlParts.slice(uploadsIndex).join('/'),
          );
        } else {
          console.warn(`Cannot extract local path from URL: ${filePath}`);
          return;
        }
      } else if (filePath.startsWith('/api/v1/uploads/')) {
        // Remove API prefix and convert to local path
        localFilePath = path.join(
          process.cwd(),
          filePath.replace('/api/v1/', ''),
        );
      }

      // Check if file exists
      if (!fs.existsSync(localFilePath)) {
        console.warn(
          `Photo file not found: ${localFilePath} (original: ${filePath})`,
        );
        return;
      }

      // Read the image file
      const imageBuffer = fs.readFileSync(localFilePath);

      // Create base64 string
      const base64Image = imageBuffer.toString('base64');
      const imageExtension = path.extname(localFilePath).toLowerCase();

      // Determine MIME type
      let mimeType = 'image/jpeg';
      if (imageExtension === '.png') mimeType = 'image/png';
      if (imageExtension === '.gif') mimeType = 'image/gif';
      if (imageExtension === '.bmp') mimeType = 'image/bmp';

      const dataUri = `data:${mimeType};base64,${base64Image}`;

      // Create image object for Excel
      const imageObj = {
        type: 'image',
        data: dataUri,
        position: {
          type: 'absolute',
          x: 10,
          y: 10,
          width: 120, // Fixed width for photos
          height: 90, // Fixed height for photos
        },
      };

      // Get cell reference
      const cellRef = XLSX.utils.encode_cell({ r: rowIndex - 1, c: colIndex });

      // Set cell content to empty and add image
      if (!worksheet[cellRef]) {
        worksheet[cellRef] = { v: '', t: 's' };
      }

      // Add image to cell (xlsx-js-style supports images)
      worksheet[cellRef].image = imageObj;
    } catch (error) {
      console.error(`❌ Error adding photo to cell:`, error);
    }
  }

  /**
   * Add hyperlinks to photo URL cells
   */
  private addHyperlinksToPhotoCells(
    worksheet: any,
    reports: Report[],
    questionCount: number,
    staticColumnCount: number,
    definedLabels: { label: string, isBeforeAfter: boolean, advancedPhotoId: number }[],
    maxUnlabeledBefore: number,
    maxUnlabeledAfter: number
  ): void {
    try {
      // Map column headers to indices
      const colMap = new Map<string, number>();
      const range = XLSX.utils.decode_range(worksheet['!ref'] || 'A1');
      
      for (let c = range.s.c; c <= range.e.c; ++c) {
          const cell = worksheet[XLSX.utils.encode_cell({ r: 0, c: c })];
          if (cell && cell.v) {
              colMap.set(cell.v, c);
          }
      }

      // Process each report row
      for (let rowIndex = 0; rowIndex < reports.length; rowIndex++) {
        const report = reports[rowIndex];
        const excelRowIndex = rowIndex + 2; // +2 because Excel is 1-indexed and we have headers

        // Separate photos by type
        const allPhotos = report.uploadedAdvancedPhotos || [];
        const unlabeledPhotos = allPhotos.filter(p => !p.label || p.label.trim() === '');
        const labeledPhotos = allPhotos.filter(p => p.label && p.label.trim() !== '');

        const unlabeledBefore = unlabeledPhotos.filter(p => p.beforeAfterType === 'before');
        const unlabeledAfter = unlabeledPhotos.filter(p => p.beforeAfterType === 'after');

        // Add hyperlinks to FOTO VORHER columns
        for (let i = 1; i <= maxUnlabeledBefore; i++) {
          const photo = unlabeledBefore[i-1];
          const colName = `FOTO\nVORHER\n${i}`;
          if (photo?.file?.path && colMap.has(colName)) {
            const url = this.formatFileUrl(photo.file.path);
            const cellRef = XLSX.utils.encode_cell({
              r: excelRowIndex - 1,
              c: colMap.get(colName)!,
            });
            this.createHyperlinkInCell(worksheet, cellRef, url, url);
          }
        }

        // Add hyperlinks to FOTO NACHHER columns
        for (let i = 1; i <= maxUnlabeledAfter; i++) {
          const photo = unlabeledAfter[i-1];
          const colName = `FOTO\nNACHHER\n${i}`;
          if (photo?.file?.path && colMap.has(colName)) {
            const url = this.formatFileUrl(photo.file.path);
            const cellRef = XLSX.utils.encode_cell({
              r: excelRowIndex - 1,
              c: colMap.get(colName)!,
            });
            this.createHyperlinkInCell(worksheet, cellRef, url, url);
          }
        }

        // Add hyperlinks to Labeled Photos
        const usedPhotoIds = new Set<number>();
        const labelCounters = new Map<string, number>();

        for (const def of definedLabels) {
            const label = def.label;
            const isBeforeAfter = def.isBeforeAfter;
            const apId = def.advancedPhotoId;
            
            const headerLabel = label.split(',')[0].trim();
            
            let count = labelCounters.get(headerLabel) || 0;
            count++;
            labelCounters.set(headerLabel, count);
            const suffix = count > 1 ? ` ${count}` : '';

            const photosForLabel = labeledPhotos.filter(p => 
                p.label?.trim() === label && 
                p.advancedPhoto?.id === apId && 
                !usedPhotoIds.has(p.id)
            );
            
            if (isBeforeAfter) {
                const beforePhoto = photosForLabel.find(p => p.beforeAfterType === 'before');
                const afterPhoto = photosForLabel.find(p => p.beforeAfterType === 'after');
                
                if (beforePhoto) usedPhotoIds.add(beforePhoto.id);
                if (afterPhoto) usedPhotoIds.add(afterPhoto.id);
                
                const beforeColName = `${headerLabel}${suffix}\n(Vorher)`;
                const afterColName = `${headerLabel}${suffix}\n(Nachher)`;
                
                if (beforePhoto?.file?.path && colMap.has(beforeColName)) {
                    const url = this.formatFileUrl(beforePhoto.file.path);
                    const cellRef = XLSX.utils.encode_cell({
                        r: excelRowIndex - 1,
                        c: colMap.get(beforeColName)!,
                    });
                    this.createHyperlinkInCell(worksheet, cellRef, url, url);
                }
                
                if (afterPhoto?.file?.path && colMap.has(afterColName)) {
                    const url = this.formatFileUrl(afterPhoto.file.path);
                    const cellRef = XLSX.utils.encode_cell({
                        r: excelRowIndex - 1,
                        c: colMap.get(afterColName)!,
                    });
                    this.createHyperlinkInCell(worksheet, cellRef, url, url);
                }
            } else {
                const photo = photosForLabel.length > 0 ? photosForLabel[0] : null;
                if (photo) usedPhotoIds.add(photo.id);
                
                const colName = `${headerLabel}${suffix}`;
                if (photo?.file?.path && colMap.has(colName)) {
                    const url = this.formatFileUrl(photo.file.path);
                    const cellRef = XLSX.utils.encode_cell({
                        r: excelRowIndex - 1,
                        c: colMap.get(colName)!,
                    });
                    this.createHyperlinkInCell(worksheet, cellRef, url, url);
                }
            }
        }
      }
    } catch (error) {
      console.error('❌ Error adding hyperlinks to photo cells:', error);
    }
  }

  /**
   * Create a hyperlink in a specific Excel cell
   */
  private createHyperlinkInCell(
    worksheet: any,
    cellRef: string,
    url: string,
    displayText: string,
  ): void {
    try {
      if (!worksheet[cellRef]) {
        worksheet[cellRef] = { v: displayText, t: 's' };
      } else if (!worksheet[cellRef].v || worksheet[cellRef].v === '') {
        worksheet[cellRef].v = displayText;
      }

      // Create hyperlink object for xlsx-js-style
      worksheet[cellRef].l = {
        Target: url,
        Tooltip: `Click to open: ${displayText}`,
      };

      // Style the hyperlink (blue color, underlined)
      worksheet[cellRef].s = {
        ...worksheet[cellRef].s,
        font: {
          ...worksheet[cellRef].s?.font,
          color: { rgb: '0000FF' }, // Blue color
          underline: true,
        },
      };
    } catch (error) {
      console.error(`❌ Error creating hyperlink in cell ${cellRef}:`, error);
    }
  }

  /**
   * Format file path to full URL (same logic as FileType @Transform decorator)
   */
  private formatFileUrl(filePath: string): string {
    if (!filePath) return '';

    // Avoid double-prefixing when path is already an absolute URL
    if (filePath.startsWith('http://') || filePath.startsWith('https://')) {
      return filePath;
    }

    const fileDriver = (fileConfig() as any).driver;

    if (fileDriver === FileDriver.LOCAL) {
      const backendDomain =
        (appConfig() as any).backendDomain || 'http://localhost:3000';
      const needsSlash = backendDomain.endsWith('/') || filePath.startsWith('/') ? '' : '/';
      return `${backendDomain}${needsSlash}${filePath}`;
    }

    // For S3 or other drivers, return as is (they should already be URLs)
    return filePath;
  }
}
