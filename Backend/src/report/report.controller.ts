import {
  Controller,
  Get,
  Post,
  Body,
  Patch,
  Param,
  Delete,
  Query,
  UseGuards,
  UseInterceptors,
  Request,
  Res,
  HttpException,
  HttpStatus,
  ForbiddenException,
  NotFoundException,
  Logger,
} from '@nestjs/common';
import {
  ApiTags,
  ApiCreatedResponse,
  ApiOkResponse,
  ApiParam,
  ApiBearerAuth,
  ApiConsumes,
  ApiBody,
} from '@nestjs/swagger';
import { AuthGuard } from '@nestjs/passport';
import { FileFieldsInterceptor } from '@nestjs/platform-express';
import { Response } from 'express';
import { ReportService } from './report.service';
import { CreateReportDto } from './dto/create-report.dto';
import { EditReportDto } from './dto/edit-report.dto';
import { SendMessageDto } from './dto/send-message.dto';
import { Report } from './domain/report';
import { FindAllReportDto } from './dto/find-all-report.dto';
import {
  InfinityPaginationResponse,
  InfinityPaginationResponseDto,
} from '../utils/dto/infinity-pagination-response.dto';
import { infinityPagination } from '../utils/infinity-pagination';
import { UpdateReportDto } from './dto/update-cities.dto';
import { BranchService } from '../branch/branch.service';
import { ProjectService } from '../project/project.service';
import { ProjectBranchService } from '../project-branch/project-branch.service';
import { ClientCompanyService } from '../client-company/client-company.service';
import { StatusService } from '../report-status/status.service';
import { ReportStatusEnum } from '../report-status/dto/status.enum';
import {
  categorizeReportCount,
  getClosedStatusIdsForUserType,
  getNextStatusOnClose,
  resolveSetupStatusId,
  shouldRecalculateSetupStatus,
} from '../report-status/report-status.util';
import { QuestionService } from '../question/question.service';
import { AnswerService } from '../answer/answer.service';
import { MerchandiserService } from '../merchandiser/merchandiser.service';
import { ClientService } from '../client/client.service';
import { ProjectAssignedClientService } from '../project-assigned-client/project-assigned-client.service';
import { QuestionOptionService } from '../question-option/question-option.service';
import { CitiesService } from '../cities/cities.service';
import { ConversationService } from '../conversation/conversation.service';
import { MessageService } from '../message/message.service';
import { MessageMapper } from '../message/infrastructure/persistence/relational/mappers/message.mapper';
import { UsersService } from '../users/users.service';
import { ClientCompanyAssignedClientService } from '../client-company-assigned-client/client-company-assigned-client.service';
import { NotificationsService } from '../notifications/notifications.service';
import { PhotoService } from '../photo/photo.service';
import { Inject, forwardRef } from '@nestjs/common';
import { AdvancedPhotoService } from '../advanced-photo/advanced-photo.service';
import { UploadedAdvancedPhotosService } from '../uploaded-advanced-photos/uploaded-advanced-photos.service';
import { FilesLocalService } from '../files/infrastructure/uploader/local/files.service';
import { AkzenteFavoriteReportsService } from '../akzente-favorite-reports/akzente-favorite-reports.service';
import { AkzenteService } from '../akzente/akzente.service';
import { ClientFavoriteReportsService } from '../client-favorite-reports/client-favorite-reports.service';
import { MerchandiserFavoriteReportsService } from '../merchandiser-favorite-reports/merchandiser-favorite-reports.service';
import { ReportStatusSchedulerService } from './report-status-scheduler.service';
import { MerchandiserFilesService } from '../merchandiser-files/merchandiser-files.service';
import { MerchandiserFileType } from '../merchandiser-files/domain/merchandiser-files';

function parseDate(value: string | number | Date | null | undefined): string | null {
  if (value === null || value === undefined || value === '') {
    return null;
  }

  if (value instanceof Date) {
    const timestamp = value.getTime();
    return isNaN(timestamp) ? null : new Date(timestamp).toISOString();
  }

  if (typeof value === 'number') {
    if (isNaN(value)) {
      return null;
    }

    // Excel stores dates as numbers counting days since 1899-12-30
    const excelEpoch = Date.UTC(1899, 11, 30);
    const millis = excelEpoch + value * 24 * 60 * 60 * 1000;
    const dateFromNumber = new Date(millis);
    return isNaN(dateFromNumber.getTime()) ? null : dateFromNumber.toISOString();
  }

  const dateStr = String(value).trim();
  if (!dateStr) {
    return null;
  }

  if (dateStr.includes('/')) {
    const [day, month, year] = dateStr.split('/');
    const date = new Date(Number(year), Number(month) - 1, Number(day));
    return isNaN(date.getTime()) ? null : date.toISOString();
  }

  if (dateStr.includes('.')) {
    const [day, month, year] = dateStr.split('.');
    const date = new Date(Number(year), Number(month) - 1, Number(day));
  return isNaN(date.getTime()) ? null : date.toISOString();
  }

  const parsed = new Date(dateStr);
  return isNaN(parsed.getTime()) ? null : parsed.toISOString();
}

@ApiTags('Report')
@ApiBearerAuth()
@UseGuards(AuthGuard('jwt'))
@Controller({
  path: 'report',
  version: '1',
})
export class ReportController {
  private readonly logger = new Logger(ReportController.name);

  private resolveRequestUserType(
    request: any,
  ): 'akzente' | 'client' | 'merchandiser' | null {
    const raw = request.user?.userType || request.user?.type?.name;
    if (!raw) {
      return null;
    }

    const normalized = String(raw).trim().toLowerCase();
    if (normalized === 'akzente' || normalized === 'client' || normalized === 'merchandiser') {
      return normalized;
    }

    return null;
  }

  private normalizeNullableDateValue(value: unknown): string | null {
    if (value === null || value === undefined) {
      return null;
    }

    if (typeof value === 'string') {
      const trimmed = value.trim();
      if (!trimmed) {
        return null;
      }
      if (trimmed.toLowerCase() === 'null' || trimmed.toLowerCase() === 'undefined') {
        return null;
      }
      return trimmed;
    }

    return String(value);
  }

  constructor(
    private readonly reportService: ReportService,
    private readonly branchService: BranchService,
    private readonly projectService: ProjectService,
    private readonly projectBranchService: ProjectBranchService,
    private readonly clientCompanyService: ClientCompanyService,
    private readonly statusService: StatusService,
    private readonly questionService: QuestionService,
    private readonly answerService: AnswerService,
    private readonly merchandiserService: MerchandiserService,
    private readonly questionOptionService: QuestionOptionService,
    private readonly citiesService: CitiesService,
    private readonly conversationService: ConversationService,
    private readonly messageService: MessageService,
    @Inject(forwardRef(() => UsersService))
    private readonly usersService: UsersService,
    @Inject(forwardRef(() => ClientCompanyAssignedClientService))
    private readonly clientCompanyAssignedClientService: ClientCompanyAssignedClientService,
    private readonly notificationsService: NotificationsService,
    private readonly photoService: PhotoService,
    private readonly advancedPhotoService: AdvancedPhotoService,
    private readonly uploadedAdvancedPhotosService: UploadedAdvancedPhotosService,
    private readonly filesLocalService: FilesLocalService,
    private readonly akzenteFavoriteReportsService: AkzenteFavoriteReportsService,
    private readonly akzenteService: AkzenteService,
    private readonly clientService: ClientService,
    private readonly clientFavoriteReportsService: ClientFavoriteReportsService,
    private readonly merchandiserFavoriteReportsService: MerchandiserFavoriteReportsService,
    private readonly reportStatusSchedulerService: ReportStatusSchedulerService,
    private readonly projectAssignedClientService: ProjectAssignedClientService,
    private readonly merchandiserFilesService: MerchandiserFilesService,
  ) {}

  @Post()
  @ApiCreatedResponse({
    type: Report,
  })
  async create(@Body() createReportDto: CreateReportDto) {
    const createdReport = await this.reportService.create(createReportDto);
    
    // Create conversation for this report
    await this.conversationService.create({
      reportId: createdReport.id,
    });
    
    return createdReport;
  }

  @Post('bulkinsert/:projectId')
  async bulkInsertReports(
    @Param('projectId') projectId: number,
    @Body() reports: any[],
  ) {
    // Get the project and its client company
    const project = await this.projectService.findById(Number(projectId));
    if (!project) throw new Error('Project not found');
    const clientCompanyId = project.clientCompany.id;

    // Load project's photo config (advancedPhotos) - ensures created reports will display correct Vorher/Nachher structure when opened for editing
    const projectAdvancedPhotos = await this.advancedPhotoService.findByProjectId(projectId);
    const advancedPhotoConfig = Array.isArray(projectAdvancedPhotos)
      ? projectAdvancedPhotos.map((ap: any) => ({
          id: ap?.id,
          labels: ap?.labels ?? [],
          isBeforeAfter: !!ap?.isBeforeAfter,
        }))
      : [];
    if (advancedPhotoConfig.length > 0) {
      this.logger.log(
        `Bulk insert: Project ${projectId} photo config - ${advancedPhotoConfig.length} advanced photo(s): ${advancedPhotoConfig.map((a: any) => `[${(a.labels || []).join(',')}] ${a.isBeforeAfter ? 'Vorher/Nachher' : 'Nachher'}`).join('; ')}`,
      );
    }

    // Get all statuses for lookup
    const allStatuses = await this.statusService.findAllWithPagination({ paginationOptions: { page: 1, limit: 100 } });
    const statusMap: Map<string | number, any> = new Map();
    for (const s of allStatuses.data) {
      statusMap.set(s.id, s);
      statusMap.set(s.name, s);
    }

    // Get all project questions for matching
    const projectQuestions = await this.questionService.findByProjectId(projectId);
    // Fetch options for each question
    for (const pq of projectQuestions as any[]) {
      pq.options = await this.questionOptionService.findByQuestionId(pq.id);
    }

    const createdReports: Report[] = [];
    const errors: Array<{ row: number; message: string }> = [];
    const skipped: Array<{ row: number; reason: string }> = [];

    for (let rowIndex = 0; rowIndex < reports.length; rowIndex++) {
      const report = reports[rowIndex];
      const rowNum = rowIndex + 1;

      try {
      const branchNumber = report.branchNumber
        ? String(report.branchNumber).trim()
        : '';
      // 1. Find or create branch using all details (name, street, zipCode, city) in the same project
      let branch: any = null;
      let cityObj: any = undefined;
      let cityId: number | undefined = undefined;
      
      if (report.city) {
        const foundCity = await this.citiesService.findOrCreateByName(
          report.city,
          report.country,
        );
        if (foundCity) {
          cityObj = { id: foundCity.id };
          cityId = foundCity.id;
        }
      }

      if (!branch && branchNumber) {
        branch = await this.branchService.findByBranchNumberAndClient(
          branchNumber,
          clientCompanyId,
        );
      }

      if (!branch && branchNumber && report.branch) {
        const branchName = String(report.branch).trim();
        if (branchName) {
          branch = await this.branchService.findByNameAndBranchNumberAndClient(
            branchName,
            branchNumber,
            clientCompanyId,
          );
        }
      }

      // When a Filialnummer is provided, do not fall back to name/location-only matching.
      // Otherwise rows that share the same Filiale name but different numbers collapse into one branch.
      if (!branch && !branchNumber && cityId) {
        branch = await this.branchService.findByNameStreetZipCodeCityAndClient(
          report.branch,
          report.street || null,
          report.zip || null,
          cityId,
          clientCompanyId,
        );
      }

      // Fallback: branch already linked to this project (only without explicit Filialnummer)
      if (!branch && !branchNumber && cityId) {
        branch = await this.branchService.findByNameStreetZipCodeCityAndProject(
          report.branch,
          report.street || null,
          report.zip || null,
          cityId,
          projectId,
        );
      }

      // If exact match found, use it
      if (branch) {
        const branchUpdates: Record<string, any> = {};
        const normalizedPhone = report.phone ? String(report.phone).trim() : '';
        const normalizedStreet = report.street ? String(report.street).trim() : '';
        const normalizedZip = report.zip ? String(report.zip).trim() : '';

        if (normalizedPhone && branch.phone !== normalizedPhone) {
          branchUpdates.phone = normalizedPhone;
        }
        if (branchNumber && branch.branchNumber !== branchNumber) {
          branchUpdates.branchNumber = branchNumber;
        }
        if (cityObj?.id && branch.city?.id !== cityObj.id) {
          branchUpdates.city = cityObj;
        }
        if (normalizedStreet && branch.street !== normalizedStreet) {
          branchUpdates.street = normalizedStreet;
        }
        if (normalizedZip && branch.zipCode !== normalizedZip) {
          branchUpdates.zipCode = normalizedZip;
        }

        if (Object.keys(branchUpdates).length > 0) {
          await this.branchService.update(branch.id, branchUpdates);
          branch = await this.branchService.findById(branch.id);
        }
      } else {
        // No exact match found, create a new branch
        // Ensure branch name is not empty
        const branchName = report.branch && String(report.branch).trim() ? String(report.branch).trim() : null;
        const branchStreet = report.street && String(report.street).trim() ? String(report.street).trim() : null;
        
        if (!branchName) {
          console.warn(`⚠️ Skipping report: branch name is missing for branch number ${branchNumber || 'N/A'}`);
          skipped.push({ row: rowNum, reason: `Filialname fehlt (Filialnummer: ${branchNumber || 'N/A'})` });
          continue; // Skip this report if branch name is missing
        }
        
        const branchCreatePayload: any = {
          name: branchName,
          branchNumber: branchNumber || null,
          street: branchStreet,
          zipCode: report.zip && String(report.zip).trim() ? String(report.zip).trim() : null,
          client: { id: clientCompanyId },
          phone: report.phone && String(report.phone).trim() ? String(report.phone).trim() : null,
        };

        if (cityObj?.id) {
          branchCreatePayload.city = cityObj;
        }

        branch = await this.branchService.create(branchCreatePayload);
      }
      
      // Create project-branch relationship if it doesn't exist
      // (handled in service, but we ensure it exists for both new and existing branches)
      await this.projectBranchService.create({
        project: { id: projectId },
        branch: { id: branch.id },
      });
      
      // 2. Merchandiser assignment by full name (needed for status determination)
      let merchandiserId: number | undefined = undefined;
      if (report.merchandiser) {
        const merchandiser = await this.merchandiserService.findByFullName(report.merchandiser);
        if (merchandiser && merchandiser.id) {
          merchandiserId = merchandiser.id;
        }
      }
      // Helper function to check if a date value is effectively empty
      const hasValidDate = (dateValue: any): boolean => {
        if (!dateValue) return false;
        if (typeof dateValue === 'string' && dateValue.trim() === '') return false;
        return true;
      };

      // Determine status: pending until both merchandiser and visit date are set
      const hasDate = hasValidDate(report.plannedOn) || hasValidDate(report.visitDate);
      const status = statusMap.get(
        resolveSetupStatusId(!!merchandiserId, hasDate),
      );
      // 4. Build CreateReportDto
      // Bidirectional sync: plannedOn and visitDate should always match
      const parsedPlannedOn = report.plannedOn ? parseDate(report.plannedOn) : null;
      const parsedVisitDate = report.visitDate ? parseDate(report.visitDate) : null;
      const syncedDate = parsedPlannedOn || parsedVisitDate;
      const createReportDto: any = {
        project: { id: project.id },
        status: { id: status.id },
        clientCompany: { id: clientCompanyId },
        branch: { id: branch.id },
        address: report.address,
        plannedOn: syncedDate,
        note: report.note,
        reportTo: report.reportTo ? parseDate(report.reportTo) : null,
        visitDate: syncedDate,
        feedback: report.feedback,
        merchandiser: merchandiserId ? { id: merchandiserId } : undefined,
        street: report.street,
        zipCode: report.zip,
        city: report.city,
        phone: report.phone,
      };
      // 5. Create report
      const created = await this.reportService.create(createReportDto);
      // 6. Handle questions/answers
      if (Array.isArray(report.questions)) {
        for (const q of report.questions) {
          const projectQuestion = (projectQuestions as any[]).find(pq => pq.questionText === q.question);
          if (projectQuestion) {
            const answerType = projectQuestion.answerType?.name?.toLowerCase().trim();
            
            // Validation for answer type vs. answer value
            if (answerType === 'multiselect' && !(Array.isArray(q.answer) || typeof q.answer === 'string')) {
              console.warn(`⚠️ Row ${rowNum}: Expected array or string for multiselect question "${q.question}", got ${typeof q.answer} — skipping answer.`);
              errors.push({ row: rowNum, message: `Ungerarter Antworttyp für Mehrfachauswahl-Frage "${q.question}"` });
              continue;
            }
            if (answerType === 'boolean' && typeof q.answer !== 'boolean') {
              console.warn(`⚠️ Row ${rowNum}: Expected boolean for question "${q.question}", got ${typeof q.answer} — skipping answer.`);
              errors.push({ row: rowNum, message: `Ungerarter Antworttyp für Ja/Nein-Frage "${q.question}"` });
              continue;
            }
            if ((answerType === 'text' || answerType === 'long text') && typeof q.answer !== 'string') {
              console.warn(`⚠️ Row ${rowNum}: Expected string for text question "${q.question}", got ${typeof q.answer} — skipping answer.`);
              errors.push({ row: rowNum, message: `Ungerarter Antworttyp für Textfrage "${q.question}"` });
              continue;
            }

            let answerPayload: any = {
              question: { id: projectQuestion.id },
              report: { id: created.id },
            };

            if (answerType === 'multiselect' || answerType === 'multiple choice') {
              // Accept both array and string for multiselect
              const selectedOptions = Array.isArray(q.answer)
                ? q.answer
                : typeof q.answer === 'string'
                  ? [q.answer]
                  : [];
              
              for (const optionText of selectedOptions) {
                // Try exact match first
                let option = (projectQuestion.options as any[]).find((opt: any) =>
                  (opt.optionText || opt.text) === optionText
                );
                
                // If no exact match, try case-insensitive match
                if (!option) {
                  option = (projectQuestion.options as any[]).find((opt: any) =>
                    (opt.optionText || opt.text).toLowerCase() === optionText.toLowerCase()
                  );
                }
                
                // If still no match, try partial match (for cases like "moption1" vs "moption 1")
                if (!option) {
                  option = (projectQuestion.options as any[]).find((opt: any) =>
                    (opt.optionText || opt.text).toLowerCase().replace(/\s+/g, '') === optionText.toLowerCase().replace(/\s+/g, '')
                  );
                }
                
                if (option && option.id) {
                  await this.answerService.create({
                    ...answerPayload,
                    selectedOption: { id: option.id },
                    textAnswer: null,
                  });
                } else {
                  console.error('No matching option found for:', optionText);
                  console.error('Available options:', (projectQuestion.options as any[]).map(opt => opt.optionText || opt.text));
                }
              }
            } else if ((answerType === 'select' || answerType === 'dropdown') && typeof q.answer === 'string') {
              // Try exact match first
              let option = (projectQuestion.options as any[]).find((opt: any) =>
                (opt.optionText || opt.text) === q.answer
              );
              
              // If no exact match, try case-insensitive match
              if (!option) {
                option = (projectQuestion.options as any[]).find((opt: any) =>
                  (opt.optionText || opt.text).toLowerCase() === q.answer.toLowerCase()
                );
              }
              
              // If still no match, try partial match
              if (!option) {
                option = (projectQuestion.options as any[]).find((opt: any) =>
                  (opt.optionText || opt.text).toLowerCase().replace(/\s+/g, '') === q.answer.toLowerCase().replace(/\s+/g, '')
                );
              }
              
              if (option && option.id) {
                await this.answerService.create({
                  ...answerPayload,
                  selectedOption: { id: option.id },
                  textAnswer: null,
                });
              } else {
                console.error('No matching option for select question:', q.answer);
                console.error('Available options:', (projectQuestion.options as any[]).map(opt => opt.optionText || opt.text));
              }
            } else if (answerType === 'boolean') {
              await this.answerService.create({
                ...answerPayload,
                textAnswer: q.answer === true ? 'true' : 'false',
              });
            } else if (answerType === 'text' || answerType === 'long text') {
              await this.answerService.create({
                ...answerPayload,
                textAnswer: String(q.answer),
              });
            } else {
              console.warn(`⚠️ Row ${rowNum}: Unrecognized answer type "${answerType}" for question "${q.question}" — skipping answer.`);
              errors.push({ row: rowNum, message: `Unbekannter Antworttyp "${answerType}" für Frage "${q.question}"` });
            }
          }
        }
      }
      
      // Create conversation for this report
      await this.conversationService.create({
        reportId: created.id,
      });
      
      createdReports.push(created);
      } catch (rowError: any) {
        console.error(`❌ Error processing row ${rowNum}:`, rowError?.message || rowError);
        errors.push({ row: rowNum, message: rowError?.message || 'Unbekannter Fehler' });
      }
    }

    return {
      reports: createdReports,
      errors,
      skipped,
      totalRows: reports.length,
      photoConfig: {
        advancedPhotos: advancedPhotoConfig,
        message:
          advancedPhotoConfig.length > 0
            ? `Project photo options applied: ${advancedPhotoConfig.map((a: any) => `[${(a.labels || []).join(', ')}] ${a.isBeforeAfter ? 'Vorher/Nachher' : 'Nachher'}`).join('; ')}`
            : 'No extended photo sections configured',
      },
    };
  }

  @Get()
  @ApiOkResponse({
    type: InfinityPaginationResponse(Report),
  })
  async findAll(
    @Query() query: FindAllReportDto,
    @Request() request: any,
  ): Promise<InfinityPaginationResponseDto<Report>> {
    const page = query?.page ?? 1;
    let limit = query?.limit ?? 10;
    if (limit > 50) {
      limit = 50;
    }

    const userId = request.user?.id;
    const { data } = await this.reportService.findAllWithPagination({
      paginationOptions: {
        page,
        limit,
      },
    });

    // Add favorite status to reports using the service method
    const reportsWithFavorites = await this.reportService.addFavoriteStatusToReports(data, userId, request);

    return infinityPagination(reportsWithFavorites, { page, limit });
  }

  @Get('project/:projectId')
  async getReportsByProject(
    @Param('projectId') projectId: number,
    @Request() request: any,
  ) {
    
    const userId = request.user?.id;
    const userType = request.user?.userType || request.user?.type?.name;
    // Security check: If user is a client, verify they are assigned to this project
    if (userType === 'client') {
      
      const client = await this.clientService.findByUserId(userId);
      
      if (!client) {
        throw new ForbiddenException('Client not found');
      }
      
      // Check if client is assigned to this project
      const projectAssignments = await this.projectAssignedClientService.findByProjectId(projectId);
      
      const isAssigned = projectAssignments.some(assignment => {
        return assignment.client.id === client.id;
      });
      
      if (!isAssigned) {
        throw new ForbiddenException('You do not have permission to access this project');
      }
    }

    // Determine user type and get appropriate reports
    return this.reportService.findByProjectIdForUserType(projectId, userId, request);
  }

  /**
   * Get appropriate error message for status filter
   */
  private getStatusFilterMessage(status: string): string {
    switch (status?.toLowerCase()) {
      case 'new':
        return 'Keine neuen Berichte in diesem Projekt vorhanden.';
      case 'completed':
        return 'Keine abgeschlossenen Berichte in diesem Projekt vorhanden.';
      case 'ongoing':
        return 'Keine laufenden Berichte in diesem Projekt vorhanden.';
      default:
        return 'Keine Daten in diesem Projekt vorhanden.';
    }
  }

  @Get('project/:projectId/export-excel')
  @ApiOkResponse({
    description: 'Export project reports as Excel file',
    content: {
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': {
        schema: {
          type: 'string',
          format: 'binary',
        },
      },
    },
  })
  async exportProjectReportsAsExcel(
    @Param('projectId') projectId: number,
    @Query('status') status: string,
    @Request() request: any,
    @Res({ passthrough: false }) res: Response,
  ) {
    const userId = request.user?.id;
    
    try {
      // Get all reports for the project with all relations including files (needed for photo URLs)
      const reports = await this.reportService.findByProjectIdForUserType(
        projectId,
        userId,
        request,
        { detailed: true },
      );
      
      // Filter reports by status if specified
      let filteredReports = reports;
      if (status) {
        const userType = this.resolveRequestUserType(request) ?? 'akzente';
        switch (status.toLowerCase()) {
          case 'new':
            filteredReports = reports.filter(
              (report) =>
                categorizeReportCount(report.status?.id, userType) === 'new',
            );
            break;

          case 'completed':
            filteredReports = reports.filter(
              (report) =>
                categorizeReportCount(report.status?.id, userType) ===
                'completed',
            );
            break;

          case 'ongoing':
            filteredReports = reports.filter(
              (report) =>
                categorizeReportCount(report.status?.id, userType) ===
                'ongoing',
            );
            break;
            
          default:
            // For any other status, do exact match by name
            filteredReports = reports.filter(report => 
              report.status?.name?.toLowerCase() === status.toLowerCase()
            );
            break;
        }
      }
      
      // Check if there are any reports to export after filtering
      // if (filteredReports.length === 0) {
      //   return res.status(404).json({
      //     error: 'NO_DATA_FOUND',
      //     message: this.getStatusFilterMessage(status)
      //   });
      // }

      // Generate Excel file
      const userType = request.user?.userType || request.user?.type?.name;
      const excelBuffer = await this.reportService.generateExcelExport(filteredReports, {
        excludeConfidentialFields: userType === 'client',
      });
      
      // Set response headers for file download
      res.set({
        'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        'Content-Disposition': `attachment; filename="project_${projectId}_reports_export.xlsx"`,
        'Content-Length': excelBuffer.length.toString(),
      });
      
      // Send the buffer directly without serialization
      res.end(excelBuffer);
    } catch (error) {
      console.error('❌ Error exporting Excel:', error);
      
      // Check if it's a "no data" error
      if (error.message && error.message.includes('Keine Daten in diesem Projekt')) {
        res.status(404).json({ 
          message: 'Keine Daten in diesem Projekt vorhanden.',
          error: 'NO_DATA_FOUND',
          projectId: projectId
        });
      } else {
        // Generic error for other issues
        res.status(500).json({ 
          message: 'Fehler beim Generieren des Excel-Exports',
          error: 'EXPORT_ERROR'
        });
      }
    }
  }

  @Get(':id/export-excel')
  @ApiOkResponse({
    description: 'Export single report as Excel file',
    content: {
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': {
        schema: {
          type: 'string',
          format: 'binary',
        },
      },
    },
  })
  async exportSingleReportAsExcel(
    @Param('id') reportId: number,
    @Request() request: any,
    @Res({ passthrough: false }) res: Response,
  ) {
    const userId = request.user?.id;
    
    try {
      // Get the single report with all relations
      const report = await this.reportService.findById(reportId, userId);
      
      if (!report) {
        return res.status(404).json({
          error: 'REPORT_NOT_FOUND',
          message: 'Bericht nicht gefunden.'
        });
      }
      
      // Generate Excel file for single report (pass as array)
      const userType = request.user?.userType || request.user?.type?.name;
      const excelBuffer = await this.reportService.generateExcelExport([report], {
        excludeConfidentialFields: userType === 'client',
      });
      
      // Set response headers for file download
      res.set({
        'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        'Content-Disposition': `attachment; filename="report_${reportId}_export.xlsx"`,
        'Content-Length': excelBuffer.length.toString(),
      });
      
      // Send the buffer directly without serialization
      res.end(excelBuffer);
    } catch (error) {
      console.error('❌ Error exporting single report Excel:', error);
      
      res.status(500).json({ 
        message: 'Fehler beim Generieren des Excel-Exports',
        error: 'EXPORT_ERROR'
      });
    }
  }

  @Get('branch/:branchId')
  async getReportsByBranch(
    @Param('branchId') branchId: number,
    @Request() request: any,
  ) {
    const userId = request.user?.id;
    return this.reportService.findByBranchId(branchId, userId, request);
  }

  @Get(':id')
  @ApiParam({
    name: 'id',
    type: Number,
    required: true,
  })
  @ApiOkResponse({
    type: Report,
  })
  async findById(
    @Param('id') id: number,
    @Request() request: any,
  ) {
    const userId = request.user?.id;
    // userType can be either request.user.userType (string) or request.user.type.name (from entity)
    const userType = request.user?.userType || request.user?.type?.name;

    // Fetch the report first
    const report = await this.reportService.findById(id, userId, request);
    
    if (!report) {
      throw new NotFoundException('Report not found');
    }

    // Attach merchandiser portrait (from merchandiser_files) if available
    if (report.merchandiser?.id) {
      try {
        const portraits = await this.merchandiserFilesService.findByMerchandiserIdAndType(
          report.merchandiser.id,
          MerchandiserFileType.PORTRAIT,
        );
        if (portraits && portraits.length > 0) {
          (report.merchandiser as any).files = portraits;
        }
      } catch (e) {
        this.logger.error('Error loading merchandiser portrait files', e as any);
      }
    }

    // Security check: If user is a merchandiser, ensure they are assigned to this report
    if (userType === 'merchandiser') {
      
      // Get the merchandiser's ID from the user
      const merchandiser = await this.merchandiserService.findByUserIdNumber(Number(userId));
      
      if (!merchandiser) {
        throw new ForbiddenException('Merchandiser not found');
      }

      // Check if the report is assigned to this merchandiser
      if (!report.merchandiser || report.merchandiser.id !== merchandiser.id) {
        throw new ForbiddenException('You do not have permission to access this report');
      }
      
    } else if (userType === 'client') {
      const client = await this.clientService.findByUserId(userId);

      if (!client) {
        throw new ForbiddenException('Client not found');
      }

      const projectId = report.project?.id;
      if (!projectId) {
        throw new ForbiddenException('Invalid report data');
      }

      const projectAssignments = await this.projectAssignedClientService.findByProjectId(projectId);
      const isProjectAssigned = projectAssignments.some(
        (assignment) => assignment.client.id === client.id,
      );

      // Clients assigned to the kunde (client company) also receive message notifications
      // for reports they may not have explicit project assignment for.
      let isClientCompanyAssigned = false;
      if (!isProjectAssigned && report.clientCompany?.id) {
        const clientCompanyAssignments =
          await this.clientCompanyAssignedClientService.findByClientCompanyId(
            report.clientCompany.id,
          );
        isClientCompanyAssigned = clientCompanyAssignments.some(
          (assignment) => assignment.client?.id === client.id,
        );
      }

      if (!isProjectAssigned && !isClientCompanyAssigned) {
        throw new ForbiddenException('You do not have permission to access this report');
      }
    }

    return report;
  }

  @Patch(':id')
  @ApiParam({
    name: 'id',
    type: Number,
    required: true,
  })
  @ApiConsumes('multipart/form-data')
  @ApiBody({
    schema: {
      type: 'object',
      properties: {
        data: {
          type: 'string',
          description: 'JSON string containing edit data',
        },
        filesToDelete: {
          type: 'array',
          items: {
            type: 'string',
          },
          description: 'IDs of uploaded advanced photos to delete',
        },
        files: {
          type: 'array',
          items: {
            type: 'string',
            format: 'binary',
          },
          description: 'Files to upload',
        },
        fileLabels: {
          type: 'array',
          items: {
            type: 'string',
          },
          description: 'Labels for the files',
        },
        advancedPhotoIds: {
          type: 'array',
          items: {
            type: 'string',
          },
          description: 'Advanced photo IDs to link files to',
        },
        beforeAfterTypes: {
          type: 'array',
          items: {
            type: 'string',
            enum: ['before', 'after'],
          },
          description: 'Before/after types for the files',
        },
        fileOrders: {
          type: 'array',
          items: {
            type: 'string',
          },
          description: 'Display order for each uploaded file',
        },
      },
    },
  })
  @UseInterceptors(FileFieldsInterceptor([{ name: 'files', maxCount: 100 }]))
  async editReport(
    @Param('id') id: number,
    @Body('data') data: string,
    @Request() request: any,
    @Body('filesToDelete') filesToDeleteRaw?: string[] | string,
    @Body('fileLabels') fileLabels?: string[],
    @Body('advancedPhotoIds') advancedPhotoIds?: string[],
    @Body('beforeAfterTypes') beforeAfterTypesRaw?: string[] | string,
    @Body('fileOrders') fileOrdersRaw?: string[] | string,
  ) {

      try {
        const filesFromBody = request.files as
          | Record<string, Express.Multer.File[]>
          | Express.Multer.File[]
          | undefined;
        const files = Array.isArray(filesFromBody)
          ? filesFromBody
          : filesFromBody?.files ?? [];

        // Parse the data JSON string
        const editData: EditReportDto = JSON.parse(data);
        
        // Handle file deletion first
        // Supports both:
        // - uploaded_advanced_photo.id (number)
        // - file.id (uuid string)
        let filesToDelete: Array<number | string> = [];
        
        if (filesToDeleteRaw) {
          if (Array.isArray(filesToDeleteRaw)) {
            filesToDelete = filesToDeleteRaw
              .map((id) => {
                const asNumber = parseInt(String(id), 10);
                return Number.isNaN(asNumber) ? String(id) : asNumber;
              })
              .filter((id) => id !== '' && id !== 'null' && id !== 'undefined');
          } else if (typeof filesToDeleteRaw === 'string') {
            try {
              // Try to parse as JSON array first
              const parsed = JSON.parse(filesToDeleteRaw);
              if (Array.isArray(parsed)) {
                filesToDelete = parsed
                  .map((id) => {
                    const asNumber = parseInt(String(id), 10);
                    return Number.isNaN(asNumber) ? String(id) : asNumber;
                  })
                  .filter((id) => id !== '' && id !== 'null' && id !== 'undefined');
              } else {
                // If JSON but not array (e.g. single number), treat as single ID
                const id = parseInt(filesToDeleteRaw, 10);
                if (!Number.isNaN(id)) {
                  filesToDelete = [id];
                } else if (filesToDeleteRaw.trim()) {
                  filesToDelete = [filesToDeleteRaw.trim()];
                }
              }
            } catch {
              // If not JSON, try to parse as comma-separated string or single ID
              if (filesToDeleteRaw.includes(',')) {
                filesToDelete = filesToDeleteRaw
                  .split(',')
                  .map((id) => id.trim())
                  .filter((id) => !!id)
                  .map((id) => {
                    const asNumber = parseInt(id, 10);
                    return Number.isNaN(asNumber) ? id : asNumber;
                  });
              } else {
                const trimmed = filesToDeleteRaw.trim();
                const id = parseInt(trimmed, 10);
                if (!Number.isNaN(id)) {
                  filesToDelete = [id];
                } else if (trimmed) {
                  filesToDelete = [trimmed];
                }
              }
            }
          }
        }
        
        // Also check if filesToDelete is in the JSON data
        if (editData.filesToDelete && Array.isArray(editData.filesToDelete)) {
          // Merge and deduplicate
          const fromJson = editData.filesToDelete
            .map((id: any) => {
              if (typeof id === 'number') {
                return Number.isNaN(id) ? null : id;
              }
              if (typeof id === 'string') {
                const trimmed = id.trim();
                if (!trimmed) return null;
                const asNumber = parseInt(trimmed, 10);
                return Number.isNaN(asNumber) ? trimmed : asNumber;
              }
              return null;
            })
            .filter((id): id is number | string => id !== null);
          filesToDelete = [...new Set([...filesToDelete, ...fromJson])];
        }
        
        
        // Delete the specified uploaded advanced photos
        if (filesToDelete.length > 0) {
          for (const uploadedPhotoId of filesToDelete) {
            try {
              // Get the uploaded advanced photo first to access the file
              let uploadedPhoto =
                typeof uploadedPhotoId === 'number'
                  ? await this.uploadedAdvancedPhotosService.findById(uploadedPhotoId)
                  : null;

              // Fallback: some clients can send file.id instead of uploaded_advanced_photo.id.
              // Resolve by file id so deletion still works.
              if (!uploadedPhoto) {
                uploadedPhoto = await this.uploadedAdvancedPhotosService.findByFileId(String(uploadedPhotoId));
              }

              if (uploadedPhoto) {
                // Delete the uploaded advanced photo record
                await this.uploadedAdvancedPhotosService.remove(uploadedPhoto.id);
                
                // Optionally, you could also delete the file from the filesystem here
                // if (uploadedPhoto.file && uploadedPhoto.file.path) {
                //   await this.filesLocalService.remove(uploadedPhoto.file.id);
                // }
              } else {
              }
            } catch (deleteError) {
              console.error(`Error deleting uploaded advanced photo ${uploadedPhotoId}:`, deleteError);
              // Continue with other deletions even if one fails
            }
          }
        }
      
      // Get the existing report (optimized version for updates)
      const existingReport = await this.reportService.findByIdForUpdate(id);
      if (!existingReport) {
        throw new Error('Report not found');
      }

      // Security check: If user is a merchandiser, ensure they are assigned to this report
      const editUserId = request.user?.id;
      // userType can be either request.user.userType (string) or request.user.type.name (from entity)
      const editUserType = request.user?.userType || request.user?.type?.name;
      
      if (editUserType === 'merchandiser') {
        const merchandiser = await this.merchandiserService.findByUserIdNumber(Number(editUserId));
        
        if (!merchandiser) {
          throw new ForbiddenException('Merchandiser not found');
        }

        // Check if the report is assigned to this merchandiser
        if (!existingReport.merchandiser || existingReport.merchandiser.id !== merchandiser.id) {
          throw new ForbiddenException('You do not have permission to edit this report');
        }

        // A report pending merchandiser acceptance must be accepted first.
        if (
          existingReport.merchandiser &&
          existingReport.accepted === false
        ) {
          throw new ForbiddenException(
            'Please accept the assignment before editing this report',
          );
        }

        const lockedStatusIds = getClosedStatusIdsForUserType('merchandiser');
        if (
          existingReport.status?.id &&
          lockedStatusIds.includes(existingReport.status.id)
        ) {
          throw new ForbiddenException(
            'Report is already closed and cannot be modified',
          );
        }
      } else if (String(editUserType).toLowerCase() === 'akzente') {
        const akzenteClosedStatusIds = getClosedStatusIdsForUserType('akzente');
        if (
          existingReport.status?.id &&
          akzenteClosedStatusIds.includes(existingReport.status.id)
        ) {
          throw new ForbiddenException(
            'Report is already closed and cannot be modified',
          );
        }
      }

      // Update report basic info
      // Bidirectional sync: plannedOn and visitDate should always match
      const updateData: any = {};

      // Handle appointmentDate explicitly, including clearing it (setting to null)
      if ('appointmentDate' in editData) {
        const normalizedAppointmentDate = this.normalizeNullableDateValue(editData.appointmentDate);
        if (normalizedAppointmentDate) {
          updateData.plannedOn = normalizedAppointmentDate;
          updateData.visitDate = normalizedAppointmentDate;
        } else {
          // Explicitly clear both dates when appointmentDate is emptied
          updateData.plannedOn = null;
          updateData.visitDate = null;
        }
      } else if ('visitDate' in editData) {
        // Handle visitDate explicitly, including clearing
        const normalizedVisitDate = this.normalizeNullableDateValue(editData.visitDate);
        if (normalizedVisitDate) {
          // When visitDate changes, plannedOn should also be updated to match
          updateData.visitDate = normalizedVisitDate;
          updateData.plannedOn = normalizedVisitDate;
        } else {
          // Explicitly clear both dates when visitDate is emptied
          updateData.visitDate = null;
          updateData.plannedOn = null;
        }
      }
      if ('reportTo' in editData) {
        // Allow clearing reportTo by sending null/empty
        updateData.reportTo = this.normalizeNullableDateValue(editData.reportTo);
      }
      if ('nextVisitDate' in editData) {
        updateData.nextVisitDate = this.normalizeNullableDateValue(editData.nextVisitDate);
      }
      if (editData.status) {
        updateData.status = { id: editData.status.id };
      }
      const isMerchandiserCleared =
        'merchandiserId' in editData &&
        (editData.merchandiserId === null || editData.merchandiserId === undefined);
      if (isMerchandiserCleared) {
        // Explicitly remove assigned merchandiser from the report.
        updateData.merchandiser = null;
      } else if (editData.merchandiserId) {
        updateData.merchandiser = { id: editData.merchandiserId };
      }

      // Auto-update status to DRAFT if conditions are met
      // Check if report has merchandiser, reportTo, plannedOn, visitDate and current status is ACCEPTED
      // Respect explicit nulls in updateData (treat as "no date" instead of falling back)
      const hasReportTo =
        'reportTo' in updateData ? !!updateData.reportTo : !!existingReport.reportTo;
      const hasPlannedOn =
        'plannedOn' in updateData ? !!updateData.plannedOn : !!existingReport.plannedOn;
      const hasVisitDate =
        'visitDate' in updateData ? !!updateData.visitDate : !!existingReport.visitDate;
      const hasMerchandiser =
        'merchandiser' in updateData ? !!updateData.merchandiser : !!existingReport.merchandiser;
      const currentStatusId = existingReport.status?.id;
      
      // Check if merchandiser is being changed (different from current)
      const currentMerchandiserId = existingReport.merchandiser?.id;
      const isMerchandiserChanged =
        !!editData.merchandiserId &&
        editData.merchandiserId !== currentMerchandiserId;
      const isMerchandiserRemoved =
        isMerchandiserCleared && !!currentMerchandiserId;

      // Auto-update status when merchandiser is changed/removed or assignment/setup fields change
      if (isMerchandiserRemoved) {
        // Removing VM always puts the report back into pending setup.
        updateData.status = { id: ReportStatusEnum.PENDING };
        updateData.accepted = false;
      } else if (isMerchandiserChanged) {
        updateData.status = { id: ReportStatusEnum.PENDING };
        updateData.accepted = false;
      } else if (
        shouldRecalculateSetupStatus(currentStatusId) &&
        ('merchandiserId' in editData ||
          'appointmentDate' in editData ||
          'visitDate' in editData)
      ) {
        if (editData.merchandiserId && currentStatusId === ReportStatusEnum.PENDING) {
          updateData.accepted = false;
        }

        updateData.status = {
          id: resolveSetupStatusId(hasMerchandiser, hasPlannedOn || hasVisitDate),
        };
      }

      // Update the report
      await this.reportService.update(id, updateData);

      // Send automatic reassignment message from backend source of truth.
      // This guarantees the merchandiser gets notified regardless of client app.
      let emailSendFailed = false;
      if (isMerchandiserChanged) {
        try {
          await this.sendMessage(
            id,
            {
              content:
                'Du wurdest diesem Einsatz zugewiesen. Du kannst ihn annehmen oder ablehnen.',
              receiverType: 'merchandiser',
              suppressNotification: true,
            },
            request,
          );
        } catch (messageError) {
          console.error('Failed to send automatic merchandiser reassignment message:', messageError);
          // Keep report update successful even if message delivery fails.
        }

        try {
          const assignedMerchandiser = await this.merchandiserService.findById(
            Number(editData.merchandiserId),
          );
          if (assignedMerchandiser?.user?.id) {
            const notificationLink = `/clients/${existingReport.clientCompany?.id}/projects/${existingReport.project?.id}/reports/${id}`;
            await this.notificationsService.create({
              message: `Neuer zugewiesener Report: ${existingReport.project?.name || 'Projekt'}. Bitte annehmen oder ablehnen.`,
              seen: false,
              link: notificationLink,
              user: { id: assignedMerchandiser.user.id } as any,
            });
          }

          const refreshedReport = await this.reportService.findByIdForUpdate(id);
          if (refreshedReport && assignedMerchandiser) {
            await this.reportService.sendAssignmentEmailToMerchandiser(
              refreshedReport,
              assignedMerchandiser,
            );
          }
        } catch (notifyError) {
          console.error(
            'Failed to send reassignment email/notification:',
            notifyError,
          );
          emailSendFailed = true;
        }
      }

      // Handle answers - only delete+recreate if answers were provided
      if (editData.answers && Array.isArray(editData.answers) && editData.answers.length > 0) {
        await this.answerService.deleteByReportId(id);
        await this.answerService.createBulk(editData.answers, id);
      }

      // Handle file uploads using shared method
      if (files && files.length > 0) {
        const normalizedFileLabels = Array.isArray(fileLabels) ? fileLabels : typeof fileLabels === 'string' ? [fileLabels] : [];
        const normalizedAdvancedPhotoIds = Array.isArray(advancedPhotoIds) ? advancedPhotoIds : typeof advancedPhotoIds === 'string' ? [advancedPhotoIds] : [];
        const beforeAfterTypes = Array.isArray(beforeAfterTypesRaw) ? beforeAfterTypesRaw : typeof beforeAfterTypesRaw === 'string' ? [beforeAfterTypesRaw] : [];

        let normalizedFileOrders: (number | undefined)[] = [];
        if (Array.isArray(fileOrdersRaw)) {
          normalizedFileOrders = fileOrdersRaw.map((v) => { const p = Number(v); return Number.isFinite(p) ? p : undefined; });
        } else if (typeof fileOrdersRaw === 'string') {
          try {
            const parsed = JSON.parse(fileOrdersRaw);
            if (Array.isArray(parsed)) {
              normalizedFileOrders = parsed.map((v: any) => { const p = Number(v); return Number.isFinite(p) ? p : undefined; });
            }
          } catch {
            const p = Number(fileOrdersRaw);
            if (Number.isFinite(p)) normalizedFileOrders = [p];
          }
        }

        const failedUploads = await this.processUploadedFiles(
          id, existingReport, files,
          normalizedFileLabels, normalizedAdvancedPhotoIds,
          beforeAfterTypes, normalizedFileOrders,
        );

        if (failedUploads.length > 0) {
          throw new HttpException(
            {
              statusCode: HttpStatus.UNPROCESSABLE_ENTITY,
              message:
                failedUploads.length === files.length
                  ? 'Die Bilder konnten nicht hochgeladen werden. Bitte verwenden Sie kleinere Dateien und versuchen Sie es erneut.'
                  : `Einige Bilder konnten nicht hochgeladen werden (${failedUploads.length} von ${files.length}). Bitte erneut speichern.`,
              failedFiles: failedUploads,
            },
            HttpStatus.UNPROCESSABLE_ENTITY,
          );
        }
      }

      const photoOrderUpdatesPayload = Array.isArray(editData.photoOrderUpdates)
        ? editData.photoOrderUpdates
        : [];

      if (photoOrderUpdatesPayload.length > 0) {
        for (const update of photoOrderUpdatesPayload) {
          try {
            // Build update payload with explicit label handling
            const updatePayload: any = {
              beforeAfterType: update.beforeAfterType,
              order: update.order,
            };
            
            // Explicitly include label if provided (including empty string or null)
            if (update.label !== undefined) {
              updatePayload.label = update.label;
            }
            
            
            await this.uploadedAdvancedPhotosService.update(update.uploadedPhotoId, updatePayload);
          } catch (updateError) {
            console.error(`Error updating uploaded photo ${update.uploadedPhotoId}:`, updateError);
          }
        }
      }

      
      // Fetch the updated report to return fresh data
      const userId = request.user?.id;
      const freshReport = await this.reportService.findById(id, userId, request);
      
      if (!freshReport) {
        throw new Error('Failed to retrieve updated report');
      }

      if (emailSendFailed) {
        (freshReport as any)._emailSendFailed = true;
      }
      
      return freshReport;
    } catch (error) {
      console.error('=== EDIT REPORT ERROR ===');
      console.error('Error occurred:', error);
      throw error;
    }
  }

  @Post(':id/upload-files')
  @ApiConsumes('multipart/form-data')
  @ApiBody({
    schema: {
      type: 'object',
      properties: {
        files: { type: 'array', items: { type: 'string', format: 'binary' }, description: 'Files to upload' },
        fileLabels: { type: 'array', items: { type: 'string' } },
        advancedPhotoIds: { type: 'array', items: { type: 'string' } },
        beforeAfterTypes: { type: 'array', items: { type: 'string', enum: ['before', 'after'] } },
        fileOrders: { type: 'array', items: { type: 'string' } },
      },
    },
  })
  @UseInterceptors(FileFieldsInterceptor([{ name: 'files', maxCount: 100 }]))
  async uploadFiles(
    @Param('id') id: number,
    @Request() request: any,
    @Body('fileLabels') fileLabels?: string[],
    @Body('advancedPhotoIds') advancedPhotoIds?: string[],
    @Body('beforeAfterTypes') beforeAfterTypesRaw?: string[] | string,
    @Body('fileOrders') fileOrdersRaw?: string[] | string,
  ): Promise<{ uploaded: number; failed: number; failedFiles: string[] }> {
    const filesFromBody = request.files as Record<string, Express.Multer.File[]> | Express.Multer.File[] | undefined;
    const files = Array.isArray(filesFromBody) ? filesFromBody : filesFromBody?.files ?? [];

    if (!files || files.length === 0) {
      return { uploaded: 0, failed: 0, failedFiles: [] };
    }

    const existingReport = await this.reportService.findByIdForUpdate(id);
    if (!existingReport) {
      throw new NotFoundException('Report not found');
    }

    const userId = request.user?.id;
    const userType = request.user?.userType || request.user?.type?.name;

    if (userType === 'merchandiser') {
      const merchandiser = await this.merchandiserService.findByUserIdNumber(Number(userId));
      if (!merchandiser || !existingReport.merchandiser || existingReport.merchandiser.id !== merchandiser.id) {
        throw new ForbiddenException('You do not have permission to upload files to this report');
      }
    }

    const normalizedFileLabels = Array.isArray(fileLabels) ? fileLabels : typeof fileLabels === 'string' ? [fileLabels] : [];
    const normalizedAdvancedPhotoIds = Array.isArray(advancedPhotoIds) ? advancedPhotoIds : typeof advancedPhotoIds === 'string' ? [advancedPhotoIds] : [];
    const beforeAfterTypes = Array.isArray(beforeAfterTypesRaw) ? beforeAfterTypesRaw : typeof beforeAfterTypesRaw === 'string' ? [beforeAfterTypesRaw] : [];

    let normalizedFileOrders: (number | undefined)[] = [];
    if (Array.isArray(fileOrdersRaw)) {
      normalizedFileOrders = fileOrdersRaw.map((v) => { const p = Number(v); return Number.isFinite(p) ? p : undefined; });
    } else if (typeof fileOrdersRaw === 'string') {
      try {
        const parsed = JSON.parse(fileOrdersRaw);
        if (Array.isArray(parsed)) {
          normalizedFileOrders = parsed.map((v: any) => { const p = Number(v); return Number.isFinite(p) ? p : undefined; });
        }
      } catch {
        const p = Number(fileOrdersRaw);
        if (Number.isFinite(p)) normalizedFileOrders = [p];
      }
    }

    const failedFiles = await this.processUploadedFiles(
      id, existingReport, files,
      normalizedFileLabels, normalizedAdvancedPhotoIds,
      beforeAfterTypes, normalizedFileOrders,
    );

    return {
      uploaded: files.length - failedFiles.length,
      failed: failedFiles.length,
      failedFiles,
    };
  }

  @Delete(':id')
  @ApiParam({
    name: 'id',
    type: Number,
    required: true,
  })
  remove(@Param('id') id: number) {
    return this.reportService.remove(id);
  }

  @Patch(':id/close')
  @ApiParam({
    name: 'id',
    type: Number,
    required: true,
  })
  @ApiBody({
    schema: {
      type: 'object',
      properties: {
        status: {
          type: 'string',
          description: 'Status to set (will be mapped based on user type)',
        },
      },
      required: ['status'],
    },
  })
  async closeReport(
    @Param('id') id: number,
    @Request() request: any,
  ): Promise<Report> {
    const userId = request.user?.id;
    const userType = this.resolveRequestUserType(request);

    if (!userType) {
      throw new ForbiddenException('Unable to determine user type for this action');
    }

    // First, check if the report is already closed (lightweight query — no messages)
    const existingReport = await this.reportService.findByIdForUpdate(id);
    if (!existingReport) {
      throw new Error('Report not found');
    }

    // Security check: If user is a merchandiser, ensure they are assigned to this report
    if (userType === 'merchandiser') {
      const merchandiser = await this.merchandiserService.findByUserIdNumber(Number(userId));
      
      if (!merchandiser) {
        throw new ForbiddenException('Merchandiser not found');
      }

      // Check if the report is assigned to this merchandiser
      if (!existingReport.merchandiser || existingReport.merchandiser.id !== merchandiser.id) {
        throw new ForbiddenException('You do not have permission to close this report');
      }
    }

    const closedStatusIds = getClosedStatusIdsForUserType(userType);

    if (existingReport.status && closedStatusIds.includes(existingReport.status.id)) {
      throw new Error('Report is already closed and cannot be modified');
    }

    const currentStatusId = existingReport.status?.id;
    const newStatusId = getNextStatusOnClose(userType, currentStatusId);

    // Update the report with the new status
    const updateDto: UpdateReportDto = {
      status: { id: newStatusId }
    };

    const updatedReport = await this.reportService.update(id, updateDto);
    if (!updatedReport) {
      throw new Error('Failed to update report status');
    }

    // Return the report in the same format as the individual report endpoint
    const reportWithDetails = await this.reportService.findById(id, userId, request);
    if (!reportWithDetails) {
      throw new Error('Failed to retrieve updated report details');
    }
    return reportWithDetails;
  }

  @Patch(':id/transition-to-in-progress')
  @ApiParam({
    name: 'id',
    type: Number,
    required: true,
  })
  async transitionToInProgress(
    @Param('id') id: number,
    @Request() request: any,
  ): Promise<Report> {
    const userId = request.user?.id;
    const userType = this.resolveRequestUserType(request);

    if (!userType) {
      throw new ForbiddenException('Unable to determine user type for this action');
    }

    // Only merchandisers can transition to in-progress
    if (userType !== 'merchandiser') {
      throw new ForbiddenException('Only merchandisers can transition reports to in-progress');
    }

    const merchandiser = await this.merchandiserService.findByUserIdNumber(Number(userId));
    if (!merchandiser) {
      throw new ForbiddenException('Merchandiser not found');
    }

    const existingReport = await this.reportService.findByIdForUpdate(id);
    if (!existingReport) {
      throw new Error('Report not found');
    }

    // Check the report is assigned to this merchandiser
    if (!existingReport.merchandiser || existingReport.merchandiser.id !== merchandiser.id) {
      throw new ForbiddenException('You do not have permission to modify this report');
    }

    // Only transition from PENDING to SCHEDULED
    const currentStatusId = existingReport.status?.id;
    if (currentStatusId !== ReportStatusEnum.PENDING) {
      throw new Error('Report is already in progress or closed');
    }

    const updateDto: UpdateReportDto = {
      status: { id: ReportStatusEnum.SCHEDULED }
    };

    const updatedReport = await this.reportService.update(id, updateDto);
    if (!updatedReport) {
      throw new Error('Failed to update report status');
    }

    const reportWithDetails = await this.reportService.findById(id, userId, request);
    if (!reportWithDetails) {
      throw new Error('Failed to retrieve updated report details');
    }
    return reportWithDetails;
  }

  @Post(':id/accept-reject')
  @ApiParam({
    name: 'id',
    type: Number,
    required: true,
  })
  @ApiBody({
    schema: {
      type: 'object',
      properties: {
        accept: {
          type: 'boolean',
          description: 'True to accept the report, false to reject it',
        },
      },
      required: ['accept'],
    },
  })
  async acceptRejectReport(
    @Param('id') id: number,
    @Body('accept') accept: boolean,
    @Request() request: any,
  ) {
    const userId = request.user?.id;
    if (!userId) {
      throw new Error('User not authenticated');
    }

    // Verify user is a merchandiser
    const merchandiser = await this.merchandiserService.findByUserIdNumber(userId);
    if (!merchandiser) {
      throw new Error('Only merchandisers can accept/reject reports');
    }

    // Get the report
    const report = await this.reportService.findById(id);
    if (!report) {
      throw new Error('Report not found');
    }

    // Verify this report is assigned to this merchandiser
    if (!report.merchandiser || report.merchandiser.id !== merchandiser.id) {
      throw new Error('This report is not assigned to you');
    }

    // Accept or reject the report
    const updatedReport = await this.reportService.acceptRejectReport(id, accept, merchandiser.id);
    return updatedReport;
  }

  @Post(':id/send-message')
  @ApiParam({
    name: 'id',
    type: Number,
    required: true,
  })
  @ApiCreatedResponse({
    description: 'Message sent successfully',
  })
  async sendMessage(
    @Param('id') reportId: number,
    @Body() sendMessageDto: SendMessageDto,
    @Request() request: any,
  ) {
    const totalStartTime = Date.now();

    try {
      // Get the current user (sender)
      const senderStartTime = Date.now();
      const sender = request.user;
      if (!sender || !sender.id) {
        throw new Error('User not authenticated');
      }

      // Get the report with minimal relations for performance (only what we need initially)
      const reportStartTime = Date.now();
      const report = await this.reportService.findByIdForUpdate(reportId);
      if (!report) {
        throw new Error('Report not found');
      }

      // Fetch conversation ID separately (we already have it from findByIdForUpdate)
      if (!report.conversation || !report.conversation.id) {
        throw new Error('Report has no conversation');
      }
      const conversationId = report.conversation.id;

      // Security check: If user is a merchandiser, ensure they are assigned to this report
      // userType can be either sender.userType (string) or sender.type.name (from entity)
      const securityCheckStartTime = Date.now();
      const userType = sender.userType || sender.type?.name;
      if (userType === 'merchandiser') {
        if (!report.merchandiser) {
          throw new ForbiddenException('You are not assigned to this report');
        }
        const merchandiser = await this.merchandiserService.findByUserIdNumber(Number(sender.id));
        
        if (!merchandiser) {
          throw new ForbiddenException('Merchandiser not found');
        }

        // Check if the report is assigned to this merchandiser
        if (report.merchandiser.id !== merchandiser.id) {
          throw new ForbiddenException('You do not have permission to send messages for this report');
        }
      }

      // Determine sender and receiver types
      const receiverResolveStartTime = Date.now();
      const senderType = String(
        sender.type?.name || sender.userType || 'akzente',
      ).toLowerCase();
      const senderIdNumeric = Number(sender.id);
      const receiverType = sendMessageDto.receiverType;

      // Determine receiver based on receiver type
      let receiverId: number;
      let receiverName: string;
      switch (receiverType) {
        case 'merchandiser':
          if (!report.merchandiser) {
            throw new Error('Report has no assigned merchandiser');
          }
          // Defensive: check if merchandiser has a user property
          const merchUser = (report.merchandiser as any).user;
          if (!merchUser || !merchUser.id) {
            throw new Error('Merchandiser has no associated user or user id');
          }
          receiverId = Number(merchUser.id);
          receiverName = `${merchUser.firstName ?? ''} ${merchUser.lastName ?? ''}`.trim();
          break;
        case 'client':
          if (!report.clientCompany) {
            throw new Error('Report has no associated client company');
          }
          
          // Find client assignments for this client company
          const clientAssignStartTime = Date.now();
          const clientAssignments = await this.clientCompanyAssignedClientService.findByClientCompanyId(report.clientCompany.id);
          
          if (clientAssignments.length === 0) {
            throw new Error('No client assignments found for this client company');
          }
          
          // Get the first client assignment (you might want to implement more sophisticated logic)
          const clientAssignment = clientAssignments[0];
          
          if (!clientAssignment.client) {
            throw new Error('Client assignment has no associated client');
          }
          
          receiverId = Number(clientAssignment.client.user.id);
          receiverName = `${clientAssignment.client.user.firstName} ${clientAssignment.client.user.lastName}`;
          break;
        
        case 'akzente':
          // Find akzente users
          const akzenteUsersStartTime = Date.now();
          const akzenteUsers = await this.usersService.findAkzenteUsers({
            filterOptions: null,
            paginationOptions: { page: 1, limit: 10 },
            sortOptions: null
          });
          
          if (akzenteUsers.data.length === 0) {
            throw new Error('No akzente users found');
          }
          
          // Pick the first actual akzente user
          const akzenteUser = akzenteUsers.data.find((u: any) => u?.type?.name?.toLowerCase() === 'akzente') || akzenteUsers.data[0];
          receiverId = Number(akzenteUser.id);
          receiverName = `${akzenteUser.firstName ?? ''} ${akzenteUser.lastName ?? ''}`.trim();
          break;
        
        default:
          throw new Error(`Invalid receiver type: ${receiverType}`);
      }
      
      const messageCreateStartTime = Date.now();
      const message = await this.messageService.create({
        conversationId: conversationId,
        senderId: sender.id,
        receiverId: receiverId,
        content: sendMessageDto.content,
        receiverType: receiverType,
      });

      
      // Create notifications for all relevant users
      const notificationStartTime = Date.now();
      if (!sendMessageDto.suppressNotification) {
      try {
        const senderName = `${sender.firstName || ''} ${sender.lastName || ''}`.trim() || 'Ein Benutzer';
        const projectName = report.project?.name || 'Unbekanntes Projekt';
        
        // Collect all user IDs who should receive notifications with their user type
        const notificationReceivers = new Map<number, string>(); // userId -> userType
        
        // If message is addressed to Akzente, notify all Akzente users (not just one).
        if (receiverType === 'akzente') {
          const akzenteUsersForReceiver = await this.usersService.findAkzenteUsers({
            filterOptions: null,
            paginationOptions: { page: 1, limit: 200 },
            sortOptions: null,
          });

          for (const akzenteUser of akzenteUsersForReceiver.data) {
            if (akzenteUser?.id) {
              const akzenteUserId = Number(akzenteUser.id);
              if (akzenteUserId !== senderIdNumeric) {
                notificationReceivers.set(akzenteUserId, 'akzente');
              }
            }
          }
        } else {
          // For client/merchandiser direct messages, notify the direct receiver.
          notificationReceivers.set(receiverId, receiverType);
        }
        
        // If sender is not client, notify ALL clients assigned to this client company
        if (senderType !== 'client' && report.clientCompany) {
          const clientNotifyStartTime = Date.now();
          const clientAssignments = await this.clientCompanyAssignedClientService.findByClientCompanyId(report.clientCompany.id);
          for (const assignment of clientAssignments) {
            if (assignment.client?.user?.id) {
              const clientUserId = Number(assignment.client.user.id);
              // Don't send notification to the sender themselves
              if (clientUserId !== senderIdNumeric) {
                notificationReceivers.set(clientUserId, 'client');
              }
            }
          }
        }
        
        // If sender is client, notify ALL Akzente admins
        if (senderType === 'client') {
          const akzenteNotifyStartTime = Date.now();
          const akzenteUsers = await this.usersService.findAkzenteUsers({
            filterOptions: null,
            paginationOptions: { page: 1, limit: 100 }, // Get all akzente users
            sortOptions: null
          });
          
          for (const akzenteUser of akzenteUsers.data) {
            if (akzenteUser?.id) {
              const akzenteUserId = Number(akzenteUser.id);
              // Don't send notification to the sender themselves
              if (akzenteUserId !== senderIdNumeric) {
                notificationReceivers.set(akzenteUserId, 'akzente');
              }
            }
          }
        }
        
        // Create notifications for all receivers with appropriate links
        const notificationCreateStartTime = Date.now();
        this.logger.log(
          `[SEND MESSAGE] Notification receivers: ${Array.from(
            notificationReceivers.entries(),
          )
            .map(([uid, utype]) => `${uid}:${utype}`)
            .join(', ')}`,
        );
        const notificationPromises = Array.from(notificationReceivers.entries()).map(async ([userId, userType], index) => {
          const singleNotifyStartTime = Date.now();
          try {
            // Generate link based on recipient type with openDialog query parameter
            let link: string;
            if (userType === 'client') {
              // Client link format: /projects/{projectId}/reports/{reportId}?openDialog=true
              link = `/projects/${report.project?.id}/reports/${reportId}?openDialog=true`;
            } else {
              // Admin/Akzente link format: /clients/{clientCompanyId}/projects/{projectId}/reports/{reportId}?openDialog=true
              link = `/clients/${report.clientCompany?.id}/projects/${report.project?.id}/reports/${reportId}?openDialog=true`;
            }
            
            await this.notificationsService.createMessageNotification({
              receiverId: userId,
              senderName: senderName,
              projectName: projectName,
              reportId: reportId,
              conversationId: conversationId,
              link: link,
            });
          } catch (error) {
            console.error(`[SEND MESSAGE] Failed to create notification ${index + 1}/${notificationReceivers.size} for user ${userId} (${Date.now() - singleNotifyStartTime}ms):`, error);
          }
        });
        
        await Promise.all(notificationPromises);
        
      } catch (notificationError) {
        console.error(`[SEND MESSAGE] Notification creation error (${Date.now() - notificationStartTime}ms):`, notificationError);
        // Don't throw here - message was sent successfully, notification is optional
      }
      }
      
      // Load all messages for the conversation with relations (filtered by user role) instead of the entire report
      // This is much faster than loading the full report with all its relations
      const returnStartTime = Date.now();
      // Use sender.id as fallback since it's guaranteed to exist (we check it earlier)
      const userId = request.user?.id || sender.id;
      
      if (!userId) {
        console.error('[SEND MESSAGE] Missing user ID - request.user:', request.user, 'sender:', sender);
        throw new Error('User ID is required for message filtering');
      }
      
      // Ensure userType is set (use sender's type or userType as fallback)
      const finalUserType = userType || sender.type?.name || sender.userType || 'akzente';
      
      // Use message service to load messages with relations
      // We need messages with sender/receiver relations for proper filtering
      const messageRepository = this.messageService['messageRepository'] as any;
      const messageEntityRepo = messageRepository.messageRepository;
      
      // Load messages with all relations needed for filtering and display
      const messageEntities = await messageEntityRepo
        .createQueryBuilder('messages')
        .leftJoinAndSelect('messages.sender', 'sender')
        .leftJoinAndSelect('sender.photo', 'sender_photo')
        .leftJoinAndSelect('sender.type', 'sender_type')
        .leftJoinAndSelect('messages.receiver', 'receiver')
        .leftJoinAndSelect('receiver.photo', 'receiver_photo')
        .leftJoinAndSelect('receiver.type', 'receiver_type')
        .where('messages.conversation = :cid', { cid: conversationId })
        .orderBy('messages.createdAt', 'ASC')
        .getMany();
      
      // Map to domain entities
      const allMessages = messageEntities.map((entity: any) => MessageMapper.toDomain(entity));
      
      // Filter messages based on user role (similar to findByIdWithFilteredConversation logic)
      const filterStartTime = Date.now();
      let filteredMessages = allMessages;
      const numericUserId = Number(userId);
      
      if (finalUserType === 'client' && report.clientCompany) {
        // Filter for client messages
        const clientAssignments = await this.clientCompanyAssignedClientService.findByClientCompanyId(report.clientCompany.id);
        const clientUserIds = clientAssignments
          .map(a => a.client?.user?.id)
          .filter(id => id !== null && id !== undefined)
          .map(id => Number(id));
        
        if (!clientUserIds.includes(numericUserId)) {
          clientUserIds.push(numericUserId);
        }
        
        filteredMessages = allMessages.filter(msg => {
          const msgSenderType = (msg.senderType as any)?.name || '';
          const msgReceiverType = (msg.receiverType as any)?.name || '';
          const isAkzenteToClient = msgSenderType.toLowerCase() === 'akzente' && clientUserIds.includes(Number(msg.receiverId));
          const isClientToAkzente = clientUserIds.includes(Number(msg.senderId)) && (msgReceiverType.toLowerCase() === 'akzente' || (msg as any).receiverTypeString === 'akzente');
          return isAkzenteToClient || isClientToAkzente;
        });
      } else if (finalUserType === 'merchandiser') {
        filteredMessages = allMessages.filter(msg => {
          const msgSenderType = (msg.senderType as any)?.name || '';
          const msgReceiverType = (msg.receiverType as any)?.name || '';
          const isAkzenteToMerch = msgSenderType.toLowerCase() === 'akzente' && Number(msg.receiverId) === numericUserId;
          const isMerchToAkzente = Number(msg.senderId) === numericUserId && (msgReceiverType.toLowerCase() === 'akzente' || (msg as any).receiverTypeString === 'akzente');
          return isAkzenteToMerch || isMerchToAkzente;
        });
      } else if (finalUserType === 'akzente') {
        filteredMessages = allMessages.filter(msg => {
          const msgSenderType = ((msg.senderType as any)?.name || '').toLowerCase();
          const msgReceiverType = ((msg.receiverType as any)?.name || '').toLowerCase();
          const receiverStr = String((msg as any).receiverTypeString || '').toLowerCase();
          return (
            msgSenderType === 'akzente' ||
            msgReceiverType === 'akzente' ||
            receiverStr === 'akzente'
          );
        });
      }
      
      return { 
        conversation: { 
          id: conversationId, 
          messages: filteredMessages 
        } 
      };
    } catch (error) {
      console.error('=== SEND MESSAGE ERROR ===');
      console.error('Error occurred:', error);
      throw error;
    }
  }

  @Post(':id/toggle-favorite')
  @ApiParam({ name: 'id', type: Number, required: true })
  @ApiOkResponse({
    schema: {
      type: 'object',
      properties: {
        isFavorite: { type: 'boolean' },
        message: { type: 'string' },
      },
    },
  })
  async toggleFavorite(
    @Param('id') reportId: number,
    @Request() request: any,
  ) {
    const userId = request.user?.id;
    if (!userId) throw new Error('User not authenticated');
    const numericReportId = Number(reportId);

    // Check if user is Akzente, Client, or Merchandiser
    const akzenteEntity = await this.akzenteService.findByUserId(userId);
    const clientEntity = await this.clientService.findByUserId(userId);
    const merchandiserEntity = await this.merchandiserService.findByUserIdNumber(userId);

      if (akzenteEntity) {
      // Akzente logic (existing)
      const existing = await this.akzenteFavoriteReportsService.findOne({ 
        akzenteId: akzenteEntity.id, 
        reportId: numericReportId 
      });
      
      if (existing) {
        await this.akzenteFavoriteReportsService.remove(existing.id);
        return { isFavorite: false, message: 'Mission Aus den Favoriten entfernt' };
      } else {
          await this.akzenteFavoriteReportsService.create({ 
            // Service expects userId in akzente.id (it calls findByUserId)
            akzente: { id: userId },
          report: { id: numericReportId } 
        });
        return { isFavorite: true, message: 'Mission Zu den Favoriten hinzugefügt' };
      }
    } else if (clientEntity) {
      // Client logic
      const existing = await this.clientFavoriteReportsService.findOne({ 
        clientId: clientEntity.id, 
        reportId: numericReportId 
      });
      
      if (existing) {
        await this.clientFavoriteReportsService.remove(existing.id);
        return { isFavorite: false, message: 'Mission Aus den Favoriten entfernt' };
      } else {
        await this.clientFavoriteReportsService.create({ 
          client: { id: userId }, // Pass userId, not clientEntity.id
          report: { id: numericReportId } 
        });
        return { isFavorite: true, message: 'Mission Zu den Favoriten hinzugefügt' };
      }
    } else if (merchandiserEntity) {
      // Merchandiser logic
      
      // Security check: Ensure the report is assigned to this merchandiser
      const report = await this.reportService.findById(numericReportId);
      if (!report) {
        throw new NotFoundException('Report not found');
      }
      
      if (!report.merchandiser || report.merchandiser.id !== merchandiserEntity.id) {
        throw new ForbiddenException('You do not have permission to favorite this report');
      }
      
      const existing = await this.merchandiserFavoriteReportsService.findOne({ 
        merchandiserId: merchandiserEntity.id, 
        reportId: numericReportId 
      });
      
      if (existing) {
        await this.merchandiserFavoriteReportsService.remove(existing.id);
        return { isFavorite: false, message: 'Mission Aus den Favoriten entfernt' };
      } else {
        await this.merchandiserFavoriteReportsService.create({ 
          merchandiser: { id: merchandiserEntity.id }, // Pass merchandiser ID, not user ID
          report: { id: numericReportId } 
        });
        return { isFavorite: true, message: 'Mission Zu den Favoriten hinzugefügt' };
      }
    } else {
      throw new Error('User not found as Akzente, Client, or Merchandiser');
    }
  }

  @Post('status-update/trigger')
  @ApiOkResponse({
    description: 'Manually trigger report status update job',
    schema: {
      type: 'object',
      properties: {
        message: { type: 'string' },
        updatedCount: { type: 'number' },
      },
    },
  })
  async triggerStatusUpdate(): Promise<{ message: string; updatedCount: number }> {
    return this.reportStatusSchedulerService.triggerStatusUpdate();
  }

  private async processUploadedFiles(
    reportId: number,
    existingReport: any,
    files: Express.Multer.File[],
    normalizedFileLabels: (string | null)[],
    normalizedAdvancedPhotoIds: (string | null)[],
    beforeAfterTypes: (string | null)[],
    normalizedFileOrders: (number | undefined)[],
  ): Promise<string[]> {
    const failedUploads: string[] = [];
    const uploadConcurrency = 4;
    let nextFileIndex = 0;

    const processFile = async (file: Express.Multer.File, i: number) => {
      if (!file.path) {
        throw new Error('File upload failed: file.path is undefined. Multer configuration issue.');
      }

      const label = normalizedFileLabels[i] || null;
      const advancedPhotoId = normalizedAdvancedPhotoIds[i]
        ? parseInt(normalizedAdvancedPhotoIds[i]!, 10)
        : null;
      const beforeAfterTypeRaw = beforeAfterTypes[i] || null;
      const beforeAfterType =
        beforeAfterTypeRaw === 'before' || beforeAfterTypeRaw === 'after'
          ? (beforeAfterTypeRaw as 'before' | 'after')
          : null;
      const orderValueRaw = normalizedFileOrders[i];
      const orderValue =
        typeof orderValueRaw === 'number' && Number.isFinite(orderValueRaw)
          ? orderValueRaw
          : i;

      const { file: uploadedFile } = await this.filesLocalService.create(file, reportId);

      if (advancedPhotoId) {
        const advancedPhoto = await this.advancedPhotoService.findById(advancedPhotoId);
        if (!advancedPhoto) {
          throw new Error(`Advanced Photo with ID ${advancedPhotoId} not found`);
        }

        await this.uploadedAdvancedPhotosService.createOptimized(
          {
            advancedPhoto: { id: advancedPhotoId },
            file: { id: uploadedFile.id, path: uploadedFile.path },
            report: { id: reportId },
            label,
            beforeAfterType,
            order: orderValue,
          },
          existingReport,
        );
        return;
      }

      if (label) {
        const newAdvancedPhoto = await this.advancedPhotoService.create({
          project: { id: existingReport.project.id },
          labels: [label],
          isVisibleInReport: true,
          isBeforeAfter: false,
        });

        await this.uploadedAdvancedPhotosService.createOptimized(
          {
            advancedPhoto: { id: newAdvancedPhoto.id },
            file: { id: uploadedFile.id, path: uploadedFile.path },
            report: { id: reportId },
            label,
            beforeAfterType,
            order: orderValue,
          },
          existingReport,
        );
      }
    };

    const workers = Array.from(
      { length: Math.min(uploadConcurrency, files.length) },
      async () => {
        while (nextFileIndex < files.length) {
          const i = nextFileIndex++;
          const file = files[i];
          try {
            await processFile(file, i);
          } catch (fileError) {
            console.error('Error processing file:', fileError);
            failedUploads.push(file.originalname || `file ${i + 1}`);
          }
        }
      },
    );

    await Promise.all(workers);
    return failedUploads;
  }
}
