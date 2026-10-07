import {
  Injectable,
  Inject,
  forwardRef,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { ClientCompanyRepository } from './infrastructure/persistence/client-company.repository';
import { ClientCompany } from './domain/client-company';
import { CreateClientCompanyDto } from './dto/create-client-company.dto';
import { UpdateClientCompanyDto } from './dto/update-client-company.dto';
import { FilesService } from '../files/files.service';
import { FilesLocalService } from '../files/infrastructure/uploader/local/files.service';
import { FileType } from '../files/domain/file';
import { IPaginationOptions } from '../utils/types/pagination-options';
import { UsersService } from '../users/users.service';
import { ClientCompanyAssignedClientService } from '../client-company-assigned-client/client-company-assigned-client.service';
import { AkzenteFavoriteClientCompaniesService } from '../akzente-favorite-client-companies/akzente-favorite-client-companies.service';
import { ClientService } from '../client/client.service';
import { AkzenteService } from '../akzente/akzente.service';
import { ClientCompanyAssignedAkzenteService } from '../client-company-assigned-akzente/client-company-assigned-akzente.service';
import { ReportService } from '../report/report.service';
import { ProjectService } from '../project/project.service';
import { ReportStatusEnum } from '../report-status/dto/status.enum';
import { categorizeReportCount } from '../report-status/report-status.util';
import { MerchandiserService } from '../merchandiser/merchandiser.service';
import { MerchandiserFavoriteClientCompanyService } from '../merchandiser-favorite-client-companies/merchandiser-favorite-client-companies.service';
import { ReportRepository } from '../report/infrastructure/persistence/report.repository';
import { BranchService } from '../branch/branch.service';

@Injectable()
export class ClientCompanyService {
  constructor(
    private readonly clientCompanyRepository: ClientCompanyRepository,
    private readonly filesService: FilesService,
    private readonly filesLocalService: FilesLocalService,
    @Inject(forwardRef(() => UsersService))
    private readonly usersService: UsersService,
    @Inject(forwardRef(() => ClientCompanyAssignedClientService))
    private readonly clientCompanyAssignedClientService: ClientCompanyAssignedClientService,
    @Inject(forwardRef(() => AkzenteFavoriteClientCompaniesService))
    private readonly akzenteFavoriteClientCompaniesService: AkzenteFavoriteClientCompaniesService,
    @Inject(forwardRef(() => ClientCompanyAssignedAkzenteService))
    private readonly clientCompanyAssignedAkzenteService: ClientCompanyAssignedAkzenteService,
    @Inject(forwardRef(() => ClientService))
    private readonly clientService: ClientService,
    @Inject(forwardRef(() => AkzenteService))
    private readonly akzenteService: AkzenteService,
    @Inject(forwardRef(() => ReportService))
    private readonly reportService: ReportService,
    @Inject(forwardRef(() => ProjectService))
    private readonly projectService: ProjectService,
    @Inject(forwardRef(() => MerchandiserService))
    private readonly merchandiserService: MerchandiserService,
    @Inject(forwardRef(() => MerchandiserFavoriteClientCompanyService))
    private readonly merchandiserFavoriteClientCompanyService: MerchandiserFavoriteClientCompanyService,
    private readonly reportRepository: ReportRepository,
    @Inject(forwardRef(() => BranchService))
    private readonly branchService: BranchService,
  ) {}

  private normalizeCompanyName(name: string): string {
    return (name ?? '').trim();
  }

  private async ensureUniqueCompanyName(name: string, excludeId?: number): Promise<void> {
    const normalizedName = this.normalizeCompanyName(name);
    if (!normalizedName) {
      return;
    }

    const existingCompany = await this.clientCompanyRepository.findByNormalizedName(
      normalizedName,
    );

    if (existingCompany && existingCompany.id !== excludeId) {
      throw new BadRequestException('Ein Kunde mit diesem Namen existiert bereits.');
    }
  }

  async create(
    createClientCompanyDto: CreateClientCompanyDto,
  ): Promise<ClientCompany> {
    const normalizedName = this.normalizeCompanyName(createClientCompanyDto.name);
    await this.ensureUniqueCompanyName(normalizedName);

    let logo: FileType | null = null;

    if (createClientCompanyDto.logo) {
      logo = await this.filesService.findById(createClientCompanyDto.logo.id);
    }

    return this.clientCompanyRepository.create({
      name: normalizedName,
      logo,
    });
  }

  async createWithFile(
    createClientCompanyDto: CreateClientCompanyDto,
    logoFile?: Express.Multer.File,
  ): Promise<ClientCompany> {
    const normalizedName = this.normalizeCompanyName(createClientCompanyDto.name);
    await this.ensureUniqueCompanyName(normalizedName);

    // Create the client company first to get the ID
    const clientCompany = await this.clientCompanyRepository.create({
      name: normalizedName,
      logo: null,
    });

    // Upload logo file if provided — now we have the client ID
    if (logoFile) {
      try {
        const { file: uploadedFile } = await this.filesLocalService.create(logoFile, undefined, clientCompany.id);
        await this.clientCompanyRepository.update(clientCompany.id, { logo: uploadedFile });
      } catch (error) {
        console.error('❌ Logo upload failed:', error);
        throw new Error('Failed to upload logo file');
      }
    }

    return this.clientCompanyRepository.findById(clientCompany.id).then((result) => {
      if (!result) {
        throw new Error('Failed to create client company');
      }
      return result;
    });
  }

  /**
   * Create client company with relationships (contacts and managers)
   */
  async createWithRelationships(
    createClientCompanyDto: CreateClientCompanyDto,
    logoFile?: Express.Multer.File,
    contactUserIds: number[] = [],
    managerUserIds: number[] = []
  ): Promise<ClientCompany> {

    // Create the basic client company
    const newClientCompany = await this.createWithFile(createClientCompanyDto, logoFile);

    if (!newClientCompany) {
      throw new Error('Failed to create client company');
    }


    // Create client assignments (Ansprechpartner Kunde)
    if (contactUserIds.length > 0) {
      await this.createClientAssignments(newClientCompany.id, contactUserIds);
    }

    // Create Akzente assignments (Projektleiter Akzente)
    if (managerUserIds.length > 0) {
      await this.createAkzenteAssignments(newClientCompany.id, managerUserIds);
    }

    return newClientCompany;
  }

  /**
   * Create client assignments for a new client company
   */
  private async createClientAssignments(clientCompanyId: number, contactUserIds: number[]) {
    try {

      // Create new assignments
      for (const userId of contactUserIds) {
        // Find the client record for this user
        const clientList = await this.clientService.findAllWithPagination({
          paginationOptions: { page: 1, limit: 1000 }
        });
        const client = clientList.data.find(c => c.user.id === userId);

        if (client) {
          // Create new assignment using DTO to avoid ID conflicts
          await this.clientCompanyAssignedClientService.create({
            client: { id: client.id },
            clientCompany: { id: clientCompanyId }
          });
        }
        // Note: It's normal for a user to not have a client entity if they're a different user type
      }

    } catch (error) {
      console.error('❌ Error creating client assignments:', error);
      throw new Error('Failed to create client assignments');
    }
  }

  /**
   * Create Akzente assignments for a new client company
   */
  private async createAkzenteAssignments(clientCompanyId: number, managerUserIds: number[]) {
    try {

      // Create new favorites
      for (const userId of managerUserIds) {
        // Find the akzente record for this user
        const akzenteList = await this.akzenteService.findAllWithPagination({
          paginationOptions: { page: 1, limit: 1000 }
        });
        const akzente = akzenteList.data.find(a => a.user.id === userId);

        if (akzente) {
          // Create new favorite using DTO to avoid ID conflicts
          await this.clientCompanyAssignedAkzenteService.create({
            akzente: { id: akzente.id },
            clientCompany: { id: clientCompanyId }
          });
        }
        // Note: It's normal for a user to not have an akzente entity if they're a different user type
      }

    } catch (error) {
      console.error('❌ Error creating Akzente assignments:', error);
      throw new Error('Failed to create Akzente assignments');
    }
  }

  findAllWithPagination({
    paginationOptions,
  }: {
    paginationOptions: IPaginationOptions;
  }) {
    return this.clientCompanyRepository.findAllWithPagination({
      paginationOptions: {
        page: paginationOptions.page,
        limit: paginationOptions.limit,
      },
    });
  }

  findById(id: ClientCompany['id']) {
    return this.clientCompanyRepository.findById(id);
  }

  findByIds(ids: ClientCompany['id'][]) {
    return this.clientCompanyRepository.findByIds(ids);
  }

  /**
   * Find client company by ID with all relationships
   */
  /**
   * Get all users for client company assignment (used in create form)
   */
  async getAllUsers() {

    // Get all users (akzente and client)
    const [akzenteUsers, clientUsers] = await Promise.all([
      this.usersService.findAkzenteUsers({
        filterOptions: { userTypeNames: ['akzente'] },
        paginationOptions: { page: 1, limit: 1000 }
      }),
      this.usersService.findAkzenteUsers({
        filterOptions: { userTypeNames: ['client'] },
        paginationOptions: { page: 1, limit: 1000 }
      })
    ]);

    return {
      clientUsers,
      akzenteUsers
    };
  }

  async findByIdWithRelationships(id: ClientCompany['id']) {
  
    // Get the client company
    const clientCompany = await this.findById(id);
    if (!clientCompany) {
      throw new NotFoundException('Client company not found');
    }

    // Get all users (akzente and client)
    const [akzenteUsers, clientUsers] = await Promise.all([
      this.usersService.findAkzenteUsers({
        filterOptions: { userTypeNames: ['akzente'] },
        paginationOptions: { page: 1, limit: 1000 }
      }),
      this.usersService.findAkzenteUsers({
        filterOptions: { userTypeNames: ['client'] },
        paginationOptions: { page: 1, limit: 1000 }
      })
    ]);

    // Load Akzente profiles to get isSales flags and map by userId
    // No longer need to fetch isSales from akzente profiles
    // isSales/isSale is now a property of client users

    // Enrich akzente users - unchanged, kept for compatibility
    const enrichedAkzenteUsers = {
      ...akzenteUsers,
      data: (akzenteUsers?.data || []).map((u: any) => ({
        ...u,
      })),
    };

    // Get client assignments for this client company
    const allAssignments = await this.clientCompanyAssignedClientService.findAllWithPagination({
      paginationOptions: { page: 1, limit: 1000 }
    });
    const clientAssignments = allAssignments.data.filter(
      assignment => assignment.clientCompany.id === id
    );


    // Filter client users to those assigned to this company (match by userId to align with frontend user objects)
    const assignedUserIds = new Set(
      clientAssignments
        .map((assignment) => assignment.client?.user?.id)
        .filter((v): v is number => typeof v === 'number')
    );
    
    
    const assignedClientUsers = {
      ...clientUsers,
      data: (clientUsers?.data || []).filter((u: any) => assignedUserIds.has(u.id)),
    };

    // Split into NON-sales contacts (isSales != true) and SALES contacts (isSales == true)
    // Note: null/undefined/false are all treated as non-sales
    const nonSalesClientUsers = {
      ...clientUsers,
      data: (clientUsers?.data || []).filter((u: any) => {
        const userAssigned = assignedUserIds.has(u.id);
        if (!userAssigned) return false;
        
        const assignmentRecord = clientAssignments.find((assignment) => assignment.client?.user?.id === u.id);
        const isSalesFlag = u?.isSales === true || u?.isSale === true || assignmentRecord?.client?.isSales === true;
        return !isSalesFlag; // NOT sales (includes null/undefined/false)
      }),
    };

    const salesClientUsers = {
      ...clientUsers,
      data: (clientUsers?.data || []).filter((u: any) => {
        const userAssigned = assignedUserIds.has(u.id);
        if (!userAssigned) return false;
        
        const assignmentRecord = clientAssignments.find((assignment) => assignment.client?.user?.id === u.id);
        const isSalesFlag = u?.isSales === true || u?.isSale === true || assignmentRecord?.client?.isSales === true;
        return isSalesFlag; // IS sales (explicitly true)
      }),
    };

    // Get favorite relationships for this client company
    const assignedAkzente = await this.clientCompanyAssignedAkzenteService.findAllWithPagination({
      paginationOptions: { page: 1, limit: 1000 }
    });
    const clientCompanyAssignedAkzente = assignedAkzente.data.filter(
      favorite => favorite.clientCompany.id === id
    );

    return {
      clientCompany,
      clientAssignments,
      clientCompanyAssignedAkzente,
      allUsers: {
        // keep full list for callers that need it
        clientUsers,
        // new subsets for assignment-aware consumers
        assignedClientUsers,
        nonSalesClientUsers, // isSales == false
        salesClientUsers,    // isSales == true
        akzenteUsers: enrichedAkzenteUsers,
      }
    };
  }

  async update(
    id: ClientCompany['id'],
    updateClientCompanyDto: UpdateClientCompanyDto,
  ) {
    if (typeof updateClientCompanyDto.name === 'string') {
      const normalizedName = this.normalizeCompanyName(updateClientCompanyDto.name);
      await this.ensureUniqueCompanyName(normalizedName, id);
      updateClientCompanyDto.name = normalizedName;
    }

    let logo: FileType | null | undefined = undefined;

    if (updateClientCompanyDto.logo) {
      logo = await this.filesService.findById(updateClientCompanyDto.logo.id);
    } else if (updateClientCompanyDto.logo === null) {
      logo = null;
    }

    return this.clientCompanyRepository.update(id, {
      ...updateClientCompanyDto,
      logo,
    });
  }

  async updateWithFile(
    id: ClientCompany['id'],
    updateClientCompanyDto: UpdateClientCompanyDto,
    logoFile?: Express.Multer.File,
  ): Promise<ClientCompany> {
    if (typeof updateClientCompanyDto.name === 'string') {
      const normalizedName = this.normalizeCompanyName(updateClientCompanyDto.name);
      await this.ensureUniqueCompanyName(normalizedName, id);
      updateClientCompanyDto.name = normalizedName;
    }

    // Get current client company to handle logo deletion if needed
    const currentClientCompany = await this.clientCompanyRepository.findById(id);
    
    if (!currentClientCompany) {
      throw new Error('ClientCompany not found');
    }

    let logo: FileType | null | undefined = undefined;

    // Upload new logo file if provided
    if (logoFile) {
      try {
        // Delete old logo if exists
        if (currentClientCompany.logo) {
          try {
            await this.filesLocalService.delete(currentClientCompany.logo.id);
          } catch (error) {
            console.warn('Failed to delete old logo:', error);
          }
        }

      // Upload new logo with client ID
      const { file: uploadedFile } = await this.filesLocalService.create(logoFile, undefined, id);
        logo = uploadedFile;
      } catch (error) {
        console.error('❌ Logo upload failed:', error);
        throw new Error('Failed to upload logo file');
      }
    }

    const updatedClientCompany = await this.clientCompanyRepository.update(id, {
      ...updateClientCompanyDto,
      logo,
    });

    if (!updatedClientCompany) {
      throw new Error('Failed to update ClientCompany');
    }

    return updatedClientCompany;
  }

  /**
   * Update client company with relationships (assignments and favorites)
   */
  async updateWithRelationships(
    id: ClientCompany['id'],
    updateClientCompanyDto: UpdateClientCompanyDto,
    logoFile?: Express.Multer.File,
    contactUserIds: number[] = [],
    managerUserIds: number[] = []
  ): Promise<ClientCompany> {
    // Update the basic client company info (name, logo)
    const updatedClientCompany = logoFile 
      ? await this.updateWithFile(id, updateClientCompanyDto, logoFile)
      : await this.update(id, updateClientCompanyDto);

    if (!updatedClientCompany) {
      throw new Error('Failed to update client company');
    }

    // Update client assignments (Ansprechpartner Kunde)
    await this.updateClientAssignments(id, contactUserIds);

    // Update favorite relationships (Projektleiter Akzente)
    await this.updateAkzenteAssignments(id, managerUserIds);

    return updatedClientCompany;
  }

  /**
   * Update client assignments for the client company
   */
  private async updateClientAssignments(clientCompanyId: number, contactUserIds: number[]) {
    try {

      // Get existing assignments for this client company
      const existingAssignments = await this.clientCompanyAssignedClientService.findByClientCompanyId(clientCompanyId);

      // Remove existing assignments
      for (const assignment of existingAssignments) {
        await this.clientCompanyAssignedClientService.remove(assignment.id);
      }

      // Create new assignments
      for (const userId of contactUserIds) {
        // Find the client record for this user
        const clientList = await this.clientService.findAllWithPagination({
          paginationOptions: { page: 1, limit: 1000 }
        });
        const client = clientList.data.find(c => c.user.id === userId);

        if (client) {
          // Create new assignment using DTO to avoid ID conflicts
          await this.clientCompanyAssignedClientService.create({
            client: { id: client.id },
            clientCompany: { id: clientCompanyId }
          });
        }
        // Note: It's normal for a user to not have a client entity if they're a different user type
      }

    } catch (error) {
      console.error('❌ Error updating client assignments:', error);
      throw new Error('Failed to update client assignments');
    }
  }

  /**
   * Update favorite relationships for the client company
   */
  private async updateAkzenteAssignments(clientCompanyId: number, managerUserIds: number[]) {
    try {

      // Get existing favorites for this client company
      const existingAkzenteAssignments = await this.clientCompanyAssignedAkzenteService.findByClientCompanyId(clientCompanyId);

      // Remove existing favorites
      for (const akzenteAssignment of existingAkzenteAssignments) {
        await this.clientCompanyAssignedAkzenteService.remove(akzenteAssignment.id);
      }

      // Create new favorites
      for (const userId of managerUserIds) {
        // Find the akzente record for this user
        const akzenteList = await this.akzenteService.findAllWithPagination({
          paginationOptions: { page: 1, limit: 1000 }
        });
        const akzente = akzenteList.data.find(a => a.user.id === userId);

        if (akzente) {
          // Create new assignment using DTO to avoid ID conflicts
          await this.clientCompanyAssignedAkzenteService.create({
            akzente: { id: akzente.id },
            clientCompany: { id: clientCompanyId }
          });
        }
        // Note: It's normal for a user to not have an akzente entity if they're a different user type
      }

    } catch (error) {
      console.error('❌ Error updating Akzente assignments:', error);
      throw new Error('Failed to update Akzente assignments');
    }
  }

  /**
   * Optimized method to get report counts for multiple client companies in a single query
   */
  private async getReportCountsForMultipleClientCompanies(clientCompanyIds: number[]): Promise<Map<number, { newReports: number; ongoingReports: number; completedReports: number }>> {
    if (!clientCompanyIds || clientCompanyIds.length === 0) {
      return new Map();
    }

    try {

      // Get all projects for all client companies in a single query
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
      console.error('Error getting optimized report counts for client companies:', error);
      // Return empty counts if there's an error
      const emptyCountsMap = new Map<number, { newReports: number; ongoingReports: number; completedReports: number }>();
      clientCompanyIds.forEach(clientCompanyId => {
        emptyCountsMap.set(clientCompanyId, { newReports: 0, ongoingReports: 0, completedReports: 0 });
      });
      return emptyCountsMap;
    }
  }

  /**
   * Helper method to get global report counts for all projects of a client company
   */
  private async getReportCountsForClientCompany(clientCompanyId: number): Promise<{ newReports: number; ongoingReports: number; completedReports: number }> {
    try {
      // Get all projects for this client company
      const projects = await this.projectService.findByClientCompanyId(clientCompanyId);
      
      if (!projects || projects.length === 0) {
        return { newReports: 0, ongoingReports: 0, completedReports: 0 };
      }

      // Get project IDs
      const projectIds = projects.map(project => project.id);

      // Use the optimized report counting method
      const reportCountsMap = await this.reportService.getReportCountsByStatusCategories(projectIds);

      // Aggregate counts across all projects
      let totalNewReports = 0;
      let totalOngoingReports = 0;
      let totalCompletedReports = 0;

      projectIds.forEach(projectId => {
        const counts = reportCountsMap.get(projectId) || { newReports: 0, ongoingReports: 0, completedReports: 0 };
        totalNewReports += counts.newReports;
        totalOngoingReports += counts.ongoingReports;
        totalCompletedReports += counts.completedReports;
      });

      return {
        newReports: totalNewReports,
        ongoingReports: totalOngoingReports,
        completedReports: totalCompletedReports,
      };
    } catch (error) {
      console.error('Error getting report counts for client company:', error);
      return { newReports: 0, ongoingReports: 0, completedReports: 0 };
    }
  }

  /**
   * Find client companies assigned to a specific Akzente user
   */
  async findAssignedCompaniesForAkzenteUser({
    paginationOptions,
    userId,
  }: {
    paginationOptions: IPaginationOptions;
    userId: number;
  }): Promise<{ data: ClientCompany[]; totalCount: number }> {
    // Convert userId to number if needed
    const numericUserId = typeof userId === 'string' ? parseInt(userId, 10) : userId;
    
    // Get user's akzente record
    const userAkzente = await this.akzenteService.findByUserId(numericUserId);

    if (!userAkzente) {
      return { data: [], totalCount: 0 };
    }

    // Get assignments for this akzente user with pagination at the database level
    const { data: assignments, totalCount } = await this.clientCompanyAssignedAkzenteService.findByAkzenteIdWithPagination(
      userAkzente.id,
      paginationOptions,
    );

    if (!assignments.length) {
      return { data: [], totalCount: 0 };
    }

    // Extract client company IDs
    const paginatedIds = assignments.map(assignment => assignment.clientCompany.id);

    const companies = await this.clientCompanyRepository.findByIds(paginatedIds);

    // Get user's favorite client companies
    const userFavorites = await this.akzenteFavoriteClientCompaniesService.findByAkzenteId(userAkzente.id);
    const favoriteCompanyIds = new Set(userFavorites.map(fav => fav.clientCompany.id));

    // Get report counts and cities for these companies
    const reportCountsMap = await this.getReportCountsForMultipleClientCompanies(paginatedIds);
    const citiesMap = await this.getCitiesForMultipleClientCompanies(paginatedIds);

    // Add favorite status, report counts, and cities to each company
    const companiesWithExtras = companies.map(company => {
      const reportCounts = reportCountsMap.get(company.id) || { newReports: 0, ongoingReports: 0, completedReports: 0 };
      const cities = citiesMap.get(company.id) || [];
      return {
        ...company,
        isFavorite: favoriteCompanyIds.has(company.id),
        isMyClient: true,
        reportCounts,
        cities,
      };
    });

    return {
      data: companiesWithExtras,
      totalCount,
    };
  }

  /**
   * Find all client companies with pagination and favorite status for a specific user
   */
  async findAllWithPaginationAndFavorites({
    paginationOptions,
    userId,
  }: {
    paginationOptions: IPaginationOptions;
    userId?: number;
  }) {
    // Get client companies
    const clientCompaniesResult = await this.clientCompanyRepository.findAllWithPagination({
      paginationOptions: {
        page: paginationOptions.page,
        limit: paginationOptions.limit,
      },
    });

    if (!userId) {
      // If no user, return companies without favorite status but with report counts and cities
      const clientCompanyIds = clientCompaniesResult.data.map(company => company.id);
      const reportCountsMap = await this.getReportCountsForMultipleClientCompanies(clientCompanyIds);
      const citiesMap = await this.getCitiesForMultipleClientCompanies(clientCompanyIds);

      const companiesWithCounts = clientCompaniesResult.data.map(company => {
        const reportCounts = reportCountsMap.get(company.id) || { newReports: 0, ongoingReports: 0, completedReports: 0 };
        const cities = citiesMap.get(company.id) || [];
        return {
          ...company,
          isFavorite: false,
          isMyClient: false,
          reportCounts,
          cities,
        };
      });

      return {
        data: companiesWithCounts,
        totalCount: clientCompaniesResult.totalCount,
      };
    }

    // Find user's akzente record
    const allAkzente = await this.akzenteService.findAllWithPagination({
      paginationOptions: { page: 1, limit: 1000 }
    });
    const userAkzente = allAkzente.data.find(akzente => akzente.user.id === userId);

    if (!userAkzente) {
      const clientCompanyIds = clientCompaniesResult.data.map(company => company.id);
      const reportCountsMap = await this.getReportCountsForMultipleClientCompanies(clientCompanyIds);
      const citiesMap = await this.getCitiesForMultipleClientCompanies(clientCompanyIds);

      const companiesWithCounts = clientCompaniesResult.data.map(company => {
        const reportCounts = reportCountsMap.get(company.id) || { newReports: 0, ongoingReports: 0, completedReports: 0 };
        const cities = citiesMap.get(company.id) || [];
        return {
          ...company,
          isFavorite: false,
          isMyClient: false,
          reportCounts,
          cities,
        };
      });

      return {
        data: companiesWithCounts,
        totalCount: clientCompaniesResult.totalCount,
      };
    }

    // Get user's favorite and assigned client companies
    const [userFavorites, assignedCompanies] = await Promise.all([
      this.akzenteFavoriteClientCompaniesService.findByAkzenteId(userAkzente.id),
      this.clientCompanyAssignedAkzenteService.findByAkzenteId(userAkzente.id),
    ]);
    const favoriteCompanyIds = new Set(userFavorites.map(fav => fav.clientCompany.id));
    const assignedCompanyIds = new Set(assignedCompanies.map(assignment => assignment.clientCompany.id));


    // Add favorite status, report counts, and cities to each company
    const clientCompanyIds = clientCompaniesResult.data.map(company => company.id);
    const reportCountsMap = await this.getReportCountsForMultipleClientCompanies(clientCompanyIds);
    const citiesMap = await this.getCitiesForMultipleClientCompanies(clientCompanyIds);

    const companiesWithFavoritesAndCounts = clientCompaniesResult.data.map(company => {
      const reportCounts = reportCountsMap.get(company.id) || { newReports: 0, ongoingReports: 0, completedReports: 0 };
      const cities = citiesMap.get(company.id) || [];
      return {
        ...company,
        isFavorite: favoriteCompanyIds.has(company.id),
        isMyClient: assignedCompanyIds.has(company.id),
        reportCounts,
        cities,
      };
    });

    return {
      data: companiesWithFavoritesAndCounts,
      totalCount: clientCompaniesResult.totalCount,
    };
  }

  /**
   * Optimized method to determine user type and get entities
   */
  private async determineUserTypeAndEntities(userId: number): Promise<{
    userType: 'akzente' | 'client' | 'merchandiser';
    akzenteEntity: any;
    clientEntity: any;
    merchandiserEntity: any;
  }> {
    try {
      // Make all calls in parallel for better performance
      const [akzenteEntity, clientEntity, merchandiserEntity] = await Promise.all([
        this.akzenteService.findByUserId(userId).catch(() => null),
        this.clientService.findByUserId(userId).catch(() => null),
        this.merchandiserService.findByUserId({ id: userId } as any).catch(() => null),
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
   * Toggle favorite status for a client company and user
   */
  async toggleFavoriteStatus(clientCompanyId: number, userId: number) {

    // Determine user type and get entities
    const { userType, akzenteEntity, clientEntity, merchandiserEntity } = await this.determineUserTypeAndEntities(userId);

    // Check if client company exists
    const clientCompany = await this.findById(clientCompanyId);
    if (!clientCompany) {
      throw new Error('Client company not found');
    }

    if (userType === 'akzente') {
      // Handle Akzente users
      if (!akzenteEntity) {
        throw new Error('Akzente record not found for user');
      }

      // Check if favorite already exists
      const existingFavorites = await this.akzenteFavoriteClientCompaniesService.findByAkzenteId(akzenteEntity.id);
      const existingFavorite = existingFavorites.find(fav => fav.clientCompany.id === clientCompanyId);

      if (existingFavorite) {
        // Remove favorite
        await this.akzenteFavoriteClientCompaniesService.remove(existingFavorite.id);
        
        return {
          isFavorite: false,
          message: 'Aus den Favoriten entfernt',
        };
      } else {
        // Add favorite
        await this.akzenteFavoriteClientCompaniesService.create({
          akzente: { id: akzenteEntity.id },
          clientCompany: { id: clientCompanyId },
        });
        
        return {
          isFavorite: true,
          message: 'Zu den Favoriten hinzugefügt',
        };
      }
    } else if (userType === 'merchandiser') {
      // Handle Merchandiser users
      if (!merchandiserEntity) {
        throw new Error('Merchandiser record not found for user');
      }

      // Check if favorite already exists
      const existingFavorites = await this.merchandiserFavoriteClientCompanyService.findByMerchandiserId(merchandiserEntity.id);
      const existingFavorite = existingFavorites.find(fav => fav.clientCompany.id === clientCompanyId);

      if (existingFavorite) {
        // Remove favorite
        await this.merchandiserFavoriteClientCompanyService.remove(existingFavorite.id);
        
        return {
          isFavorite: false,
          message: 'Aus den Favoriten entfernt',
        };
      } else {
        // Add favorite
        await this.merchandiserFavoriteClientCompanyService.create({
          merchandiser: { id: userId }, // Pass user ID, not merchandiser ID
          clientCompany: { id: clientCompanyId },
        });        
        return {
          isFavorite: true,
          message: 'Zu den Favoriten hinzugefügt',
        };
      }
    } else {
      // Client users don't have favorite client companies
      throw new Error('Client users cannot favorite client companies');
    }
  }

  /**
   * Get projects for a client company based on user type
   * - Akzente users: Get all projects for the client company
   * - Merchandiser users: Get only projects where the merchandiser has reports
   */
  async getProjectsForUserType(clientCompanyId: number, userId?: number): Promise<any[]> {
    if (!userId) {
      // If no user ID, return all projects (fallback behavior)
      return this.projectService.getProjectsWithBranchCount(clientCompanyId, userId);
    }

    try {
      // Determine user type
      const { userType, merchandiserEntity } = await this.determineUserTypeAndEntities(userId);
      

      if (userType === 'merchandiser' && merchandiserEntity) {
        // For merchandisers, get only projects where they have reports
        return this.getProjectsForMerchandiser(clientCompanyId, merchandiserEntity.id, userId);
      } else {
        // For Akzente users (or other types), return all projects
        return this.projectService.getProjectsWithBranchCount(clientCompanyId, userId);
      }
    } catch (error) {
      console.error('❌ Error determining user type for projects:', error);
      // Fallback to all projects on error
      return this.projectService.getProjectsWithBranchCount(clientCompanyId, userId);
    }
  }

  /**
   * Get projects for a merchandiser - only projects where the merchandiser has reports
   */
  private async getProjectsForMerchandiser(clientCompanyId: number, merchandiserId: number, userId: number): Promise<any[]> {

    // Get all projects for the client company
    const allProjects = await this.projectService.findByClientCompanyId(clientCompanyId);
    
    // Get all reports for this merchandiser
    const merchandiserReports = await this.reportService.findByMerchandiserId(merchandiserId);
    
    // Get project IDs where the merchandiser has reports
    const projectIdsWithReports = new Set(merchandiserReports.map(report => report.project.id));
    
    // Filter projects to only include those where the merchandiser has reports
    const filteredProjects = allProjects.filter(project => projectIdsWithReports.has(project.id));
    
    if (filteredProjects.length === 0) {
      return [];
    }

    const projectIds = filteredProjects.map(p => p.id);

    // Fetch counts in parallel using optimized repository methods (counts are per report, not distinct branches)
    const [reportCounts, completedReportCounts] = await Promise.all([
      this.reportRepository.getBranchCountsForProjects(projectIds),
      this.reportRepository.getCompletedBranchCountsForProjects(projectIds)
    ]);

    // Create maps for O(1) lookup
    const reportCountsMap = new Map<number, number>();
    reportCounts.forEach(c => reportCountsMap.set(c.projectId, c.count));

    const completedReportCountsMap = new Map<number, number>();
    completedReportCounts.forEach(c => completedReportCountsMap.set(c.projectId, c.count));

    const result: any[] = filteredProjects.map(project => {
      const branchesCount = reportCountsMap.get(project.id) || 0; // now total reports
      const completedBranchesCount = completedReportCountsMap.get(project.id) || 0; // now total OK reports
      
      let reportedPercentage = 0;
      if (branchesCount > 0) {
        reportedPercentage = (completedBranchesCount / branchesCount) * 100;
      }
      
      return { 
        ...project, 
        branchesCount,
        reportedPercentage 
      };
    });
    
    // Add favorite status to projects
    return this.projectService.addFavoriteStatusToProjects(result, userId);
  }

  remove(id: ClientCompany['id']) {
    return this.clientCompanyRepository.remove(id);
  }

  /**
   * Get cities for multiple client companies through their branches
   */
  private async getCitiesForMultipleClientCompanies(clientCompanyIds: number[]): Promise<Map<number, any[]>> {
    const citiesMap = new Map<number, any[]>();

    // Process each client company to get its cities through branches
    for (const clientCompanyId of clientCompanyIds) {
      try {
        // Get branches for this client company (which includes cities)
        const branches = await this.branchService.findByClientCompanyId(clientCompanyId);
        
        // Extract unique cities from branches
        const cities = branches
          .map(branch => branch.city)
          .filter((city, index, self) => 
            city && self.findIndex(c => c && c.id === city.id) === index
          );

        citiesMap.set(clientCompanyId, cities);
      } catch (error) {
        console.error(`Error getting cities for client company ${clientCompanyId}:`, error);
        citiesMap.set(clientCompanyId, []);
      }
    }

    return citiesMap;
  }
}
