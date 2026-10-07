import { HttpStatus, Injectable, UnprocessableEntityException, ConflictException, Inject, forwardRef } from '@nestjs/common';
import { CreateMerchandiserDto } from './dto/create-merchandiser.dto';
import { UpdateMerchandiserDto } from './dto/update-merchandiser.dto';
import { MerchandiserRepository } from './infrastructure/persistence/merchandiser.repository';
import { IPaginationOptions } from '../utils/types/pagination-options';
import { Merchandiser } from './domain/merchandiser';
import { UsersService } from '../users/users.service';
import { JobTypesService } from '../job-types/job-types.service';
import { User } from '../users/domain/user';
import { JobTypes } from '../job-types/domain/job-types';
import { JwtPayloadType } from '../auth/strategies/types/jwt-payload.type';
import { CitiesService } from '../cities/cities.service';
import { Cities } from '../cities/domain/cities';
import { MerchandiserLanguagesRepository } from '../merchandiser-languages/infrastructure/persistence/merchandiser-languages.repository';
import { MerchandiserSpecializationsRepository } from '../merchandiser-specializations/infrastructure/persistence/merchandiser-specializations.repository';
import { MerchandiserReferencesRepository } from '../merchandiser-references/infrastructure/persistence/merchandiser-references.repository';
import { MerchandiserEducationRepository } from '../merchandiser-education/infrastructure/persistence/merchandiser-education.repository';
import { CountriesRepository } from '../countries/infrastructure/persistence/countries.repository';
import { JobTypesRepository } from '../job-types/infrastructure/persistence/job-types.repository';
import { LanguagesRepository } from '../languages/infrastructure/persistence/languages.repository';
import { SpecializationsRepository } from '../specializations/infrastructure/persistence/specializations.repository';
import { CitiesRepository } from '../cities/infrastructure/persistence/cities.repository';
import { LanguageLevel } from '../merchandiser-languages/domain/merchandiser-languages';
import { MerchandiserFilesService } from '../merchandiser-files/merchandiser-files.service';
import { MerchandiserFileType } from '../merchandiser-files/domain/merchandiser-files';
import { FilterMerchandiserDto, SortMerchandiserDto } from './dto/query-merchandiser.dto';
import { AkzenteFavoriteMerchandisersService } from '../akzente-favorite-merchandisers/akzente-favorite-merchandiser.service';
import { AkzenteService } from '../akzente/akzente.service';
import { ReviewService } from '../merchandiser-reviews/merchandiser-reviews.service';
import { ContractualsService } from '../contractuals/contractuals.service';
import { ContractualsRepository } from '../contractuals/infrastructure/persistence/contractuals.repository';
import { Contractuals } from '../contractuals/domain/contractuals';
import { UserTypeEnum } from '../user-type/user-types.enum';
import { MerchandiserStatusService } from '../merchandiser-statuses/status.service';
import { MerchandiserJobTypesRepository } from '../merchandiser-job-types/infrastructure/persistence/merchandiser-job-types.repository';
import { MerchandiserJobTypesService } from '../merchandiser-job-types/merchandiser-job-types.service';
import { MerchandiserFavoriteReportsService } from '../merchandiser-favorite-reports/merchandiser-favorite-reports.service';
import { MerchandiserFavoriteProjectService } from '../merchandiser-favorite-projects/merchandiser-favorite-projects.service';
import { MerchandiserFavoriteClientCompanyService } from '../merchandiser-favorite-client-companies/merchandiser-favorite-client-companies.service';
import { ReportService } from '../report/report.service';
import { ClientCompanyService } from '../client-company/client-company.service';
import { ClientCompanyAssignedClientService } from '../client-company-assigned-client/client-company-assigned-client.service';
import { ReportStatusEnum } from '../report-status/dto/status.enum';
import { categorizeReportCount } from '../report-status/report-status.util';
import { SessionService } from '../session/session.service';
import { MailService } from '../mail/mail.service';

@Injectable()
export class MerchandiserService {
  constructor(
    private readonly merchandiserRepository: MerchandiserRepository,
    @Inject(forwardRef(() => UsersService))
    private readonly usersService: UsersService,
    private readonly citiesService: CitiesService,
    private readonly jobTypesService: JobTypesService,
    private readonly contractualsService: ContractualsService,
    private readonly merchandiserLanguagesRepository: MerchandiserLanguagesRepository,
    private readonly merchandiserSpecializationsRepository: MerchandiserSpecializationsRepository,
    private readonly merchandiserReferencesRepository: MerchandiserReferencesRepository,
    private readonly merchandiserEducationRepository: MerchandiserEducationRepository,
    private readonly countriesRepository: CountriesRepository,
    private readonly jobTypesRepository: JobTypesRepository,
    private readonly contractualsRepository: ContractualsRepository,
    private readonly languagesRepository: LanguagesRepository,
    private readonly specializationRepository: SpecializationsRepository,
    private readonly citiesRepository: CitiesRepository,
    private readonly merchandiserStatusesService: MerchandiserStatusService,
    @Inject(forwardRef(() => MerchandiserFilesService))
    private readonly merchandiserFilesService: MerchandiserFilesService,
    @Inject(forwardRef(() => AkzenteFavoriteMerchandisersService))
    private readonly akzenteFavoriteMerchandisersService: AkzenteFavoriteMerchandisersService,
    @Inject(forwardRef(() => AkzenteService))
    private readonly akzenteService: AkzenteService,
    @Inject(forwardRef(() => ReviewService))
    private readonly reviewService: ReviewService,
    @Inject(forwardRef(() => MerchandiserJobTypesService))
    private readonly merchandiserJobTypesService: MerchandiserJobTypesService,
    @Inject(forwardRef(() => MerchandiserFavoriteReportsService))
    private readonly merchandiserFavoriteReportsService: MerchandiserFavoriteReportsService,
    @Inject(forwardRef(() => MerchandiserFavoriteProjectService))
    private readonly merchandiserFavoriteProjectService: MerchandiserFavoriteProjectService,
    @Inject(forwardRef(() => ReportService))
    private readonly reportService: ReportService,
    @Inject(forwardRef(() => ClientCompanyService))
    private readonly clientCompanyService: ClientCompanyService,
    @Inject(forwardRef(() => ClientCompanyAssignedClientService))
    private readonly clientCompanyAssignedClientService: ClientCompanyAssignedClientService,
    @Inject(forwardRef(() => MerchandiserFavoriteClientCompanyService))
    private readonly merchandiserFavoriteClientCompanyService: MerchandiserFavoriteClientCompanyService,
    private readonly sessionService: SessionService,
    private readonly mailService: MailService,
  ) { }

  async create(
    createMerchandiserDto: CreateMerchandiserDto,
  ): Promise<Merchandiser> {
    const user = await this.usersService.findById(
      createMerchandiserDto.user.id,
    );
    if (!user) {
      throw new Error('User not found');
    }

    const city = await this.citiesService.findById(
      createMerchandiserDto.city.id,
    );
    if (!city) {
      throw new Error('City not found');
    }

    let jobTypes: JobTypes[] = [];
    if (createMerchandiserDto.jobTypeIds && createMerchandiserDto.jobTypeIds.length > 0) {
      jobTypes = await this.jobTypesService.findByIds(createMerchandiserDto.jobTypeIds);
      if (jobTypes.length !== createMerchandiserDto.jobTypeIds.length) {
        throw new Error('Some job types not found');
      }
    }

    return this.merchandiserRepository.create({
      user,
      birthday: createMerchandiserDto.birthday && createMerchandiserDto.birthday !== ''
        ? (() => {
            const date = new Date(createMerchandiserDto.birthday);
            return isNaN(date.getTime()) ? null : date;
          })()
        : null,
      website: createMerchandiserDto.website,
      street: createMerchandiserDto.street,
      zipCode: createMerchandiserDto.zipCode,
      city,
      nationality: createMerchandiserDto.nationality,
      jobTypes,
    });
  }

  findAllWithPagination({
    paginationOptions,
    filters,
    sort,
  }: {
    paginationOptions: IPaginationOptions;
    filters?: FilterMerchandiserDto | null;
    sort?: SortMerchandiserDto[] | null;
  }) {
    return this.merchandiserRepository.findAllWithPagination({
      paginationOptions: {
        page: paginationOptions.page,
        limit: paginationOptions.limit,
      },
      filters,
      sort,
    });
  }

  /**
   * Get filter options for merchandiser search (job types and statuses)
   */
  async getFilterOptions() {
    
    // Fetch all job types
    const jobTypesResult = await this.jobTypesService.findAllWithPagination({
      paginationOptions: { page: 1, limit: 1000 }
    });
    
    // Fetch all merchandiser statuses
    const statusesResult = await this.merchandiserStatusesService.findAllWithPagination({
      paginationOptions: { page: 1, limit: 1000 }
    });
    
    const filterOptions = {
      jobTypes: jobTypesResult.data.map(jt => ({
        id: jt.id,
        name: jt.name
      })),
      statuses: statusesResult.data.map(s => ({
        id: s.id,
        name: s.name
      }))
    };
    
    return filterOptions;
  }

  /**
   * Find merchandiser by ID with all relationships loaded
   */
  async findByIdWithRelations(id: Merchandiser['id'], userId?: number) {
    // Get basic merchandiser data
    const merchandiser = await this.merchandiserRepository.findById(id);

    if (!merchandiser) {
      return null;
    }

    // Load all relationships using existing services
    const [languages, specializations, references, education, files, reviews, merchandiserJobTypes, merchandiserReports] = await Promise.all([
      this.merchandiserLanguagesRepository.findByMerchandiserId(merchandiser.id),
      this.merchandiserSpecializationsRepository.findByMerchandiserId(merchandiser.id),
      this.merchandiserReferencesRepository.findByMerchandiserId(merchandiser.id),
      this.merchandiserEducationRepository.findByMerchandiserId(merchandiser.id),
      this.merchandiserFilesService.findByMerchandiserId(merchandiser.id),
      this.reviewService.findByMerchandiserId(merchandiser.id), // Add reviews
      this.merchandiserJobTypesService.findByMerchandiserId(merchandiser.id), // Add job types with comments
      this.reportService.findByMerchandiserId(merchandiser.id), // Add reports to get projects
    ]);

    // Calculate review statistics
    const reviewStats = await this.reviewService.getMerchandiserStats(merchandiser.id);

    // Check if this merchandiser is favorited by the current user
    let isFavorite = false;
    if (userId) {
      try {
        // Find user's akzente record
        const allAkzente = await this.akzenteService.findAllWithPagination({
          paginationOptions: { page: 1, limit: 1000 }
        });
        const userAkzente = allAkzente.data.find(akzente => akzente.user.id === userId);

        if (userAkzente) {
          // Check if this merchandiser is in user's favorites
          const userFavorites = await this.akzenteFavoriteMerchandisersService.findByAkzenteId(userAkzente.id);
          isFavorite = userFavorites.some(fav => fav.merchandiser.id === merchandiser.id);
        }
      } catch (error) {
        console.warn('Error checking favorite status:', error);
        // Continue without favorite status if there's an error
      }
    }

    // Return merchandiser with all relationships and favorite status
    // Categorize projects based on report statuses
    const projectsMap = new Map<number, any>();
    
    merchandiserReports.forEach(report => {
      const projectId = report.project.id;
      if (!projectsMap.has(projectId)) {
        projectsMap.set(projectId, {
          id: report.project.id,
          name: report.project.name,
          clientCompany: {
            id: report.project.clientCompany?.id,
            name: report.project.clientCompany?.name
          },
          createdAt: report.project.createdAt,
          updatedAt: report.project.updatedAt,
          status: report.status.name,
          statusId: report.status.id
        });
      }
    });

    // Categorize projects into past and current
    const allProjects = Array.from(projectsMap.values());
    const pastProjects = allProjects.filter(project => project.statusId === 8); // ACCEPTED_BY_CLIENT
    const currentProjects = allProjects.filter(project => project.statusId !== 8);

    const mappedJobTypes = merchandiserJobTypes.map(mjt => {
      return {
        id: mjt.id,
        jobTypeId: mjt.jobType?.id,
        name: mjt.jobType?.name,
        comment: mjt.comment
      };
    });


    return {
      ...merchandiser,
      languages,
      specializations,
      references,
      education,
      files,
      reviews,
      jobTypes: mappedJobTypes,
      reviewStats: {
        averageRating: reviewStats.averageRating,
        reviewCount: reviewStats.reviewCount,
      },
      isFavorite,
      projects: {
        past: pastProjects,
        current: currentProjects
      }
    };
  }

  // Keep the original findById for cases where you don't need relationships
  findById(id: Merchandiser['id']) {
    return this.merchandiserRepository.findById(id);
  }

  findByIds(ids: Merchandiser['id'][]) {
    return this.merchandiserRepository.findByIds(ids);
  }

  async findByUserId(userJwtPayload: JwtPayloadType): Promise<Merchandiser | null> {
    
    // The JWT payload id should be a number, but let's handle both cases
    const userId = typeof userJwtPayload.id === 'string' ? parseInt(userJwtPayload.id, 10) : userJwtPayload.id;
    
    if (isNaN(userId) || userId <= 0) {
      console.error('❌ Invalid user ID:', userJwtPayload.id);
      throw new Error('Invalid user ID provided to findByUserId');
    }
    
    const result = await this.merchandiserRepository.findByUserId(userId);
    
    return result;
  }

  async findByUserIdNumber(userId: number): Promise<Merchandiser | null> {
    return this.merchandiserRepository.findByUserId(userId);
  }

  async update(
    id: Merchandiser['id'],
    updateData: any,
  ) {

    // Get the merchandiser
    const merchandiser = await this.merchandiserRepository.findById(id);
    if (!merchandiser) {
      throw new Error('Merchandiser not found');
    }

    // Get the user
    const user = await this.usersService.findById(merchandiser.user.id);
    if (!user) {
      throw new Error('User not found');
    }

    // Check for email change — requires session validation + uniqueness check + welcome email
    let emailChanged = false;
    let welcomeEmailSent = true;
    const newEmailRaw = updateData.email;
    if (newEmailRaw && newEmailRaw.toLowerCase().trim() !== (user.email || '').toLowerCase().trim()) {
      // 1. Check for recent user activity within 15-minute window
      const RECENT_WINDOW_MS = 15 * 60 * 1000;
      const hasRecentActivity = await this.sessionService.hasRecentActivity(
        user.id,
        RECENT_WINDOW_MS,
      );

      if (hasRecentActivity) {
        if (!updateData.forceEmailUpdate) {
          throw new ConflictException({
            status: HttpStatus.CONFLICT,
            code: 'MERCHANDISER_HAS_ACTIVE_SESSIONS',
            message: 'Der Mitarbeiter ist aktuell angemeldet. Die E-Mail kann erst geändert werden, nachdem er sich abgemeldet hat.',
          });
        }

        // Force-disconnect: terminate all sessions and proceed
        await this.sessionService.deleteByUserId({ userId: user.id });
      }

      // 2. Check if email is already taken by another user
      const normalizedNewEmail = newEmailRaw.toLowerCase().trim();
      const existingUser = await this.usersService.findByEmail(normalizedNewEmail);
      if (existingUser && existingUser.id !== user.id) {
        throw new ConflictException({
          status: HttpStatus.CONFLICT,
          code: 'EMAIL_ALREADY_EXISTS',
          message: 'Diese E-Mail-Adresse wird bereits von einem anderen Benutzer verwendet. Bitte wählen Sie eine andere E-Mail-Adresse.',
        });
      }

      emailChanged = true;
    }

    // Update user data
    if (updateData.firstName) user.firstName = updateData.firstName;
    if (updateData.lastName) user.lastName = updateData.lastName;
    if (updateData.phone) user.phone = updateData.phone;
    if (updateData.email) user.email = updateData.email;

    // Use try-catch to handle any errors from usersService.update (e.g. duplicate email)
    try {
      await this.usersService.update(user.id, {
        firstName: user.firstName,
        lastName: user.lastName,
        phone: user.phone,
        email: user.email,
      });
    } catch (err: any) {
      if (err?.message?.includes?.('already exists') || err?.response?.code === 'EMAIL_ALREADY_EXISTS') {
        throw new ConflictException({
          status: HttpStatus.CONFLICT,
          code: 'EMAIL_ALREADY_EXISTS',
          message: 'Diese E-Mail-Adresse wird bereits von einem anderen Benutzer verwendet. Bitte wählen Sie eine andere E-Mail-Adresse.',
        });
      }
      throw err;
    }

    // Send welcome email to the new address if email changed
    // Wrap in try-catch so email failure does NOT roll back the email update
    if (emailChanged) {
      const targetEmail = (user.email || newEmailRaw || '').toLowerCase().trim();
      if (targetEmail) {
        try {
          await this.mailService.akzenteWelcome({
            to: targetEmail,
            data: {
              firstName: user.firstName || '',
              userType: UserTypeEnum.merchandiser,
            },
          });
          welcomeEmailSent = true;
        } catch (emailErr: any) {
          console.error(
            '⚠️ Email updated but welcome email could not be sent to',
            targetEmail,
            emailErr?.message || emailErr,
          );
          welcomeEmailSent = false;
        }
      }
    }

    // Update merchandiser basic data
    const merchandiserUpdateData: any = {};

    if (updateData.dateOfBirth !== undefined) {
      // Handle empty string or null - set to null
      if (!updateData.dateOfBirth || updateData.dateOfBirth === '' || updateData.dateOfBirth === null) {
        merchandiserUpdateData.birthday = null;
      } else {
        // Validate date before creating Date object
        const date = new Date(updateData.dateOfBirth);
        if (isNaN(date.getTime())) {
          // Invalid date, set to null
          merchandiserUpdateData.birthday = null;
        } else {
          merchandiserUpdateData.birthday = date;
        }
      }
    }
    if (updateData.website !== undefined) {
      merchandiserUpdateData.website = updateData.website;
    }
    if (updateData.address !== undefined) {
      merchandiserUpdateData.street = updateData.address;
    } else if (updateData.street !== undefined) {
      merchandiserUpdateData.street = updateData.street;
    }
    if (updateData.postalCode !== undefined) {
      merchandiserUpdateData.zipCode = updateData.postalCode;
    }
    if (updateData.country !== undefined) {
      merchandiserUpdateData.nationality = updateData.country;
    }
    if (updateData.deliveryAddress !== undefined) {
      merchandiserUpdateData.deliveryStreet = updateData.deliveryAddress;
    }
    if (updateData.deliveryPostalCode !== undefined) {
      merchandiserUpdateData.deliveryZipCode = updateData.deliveryPostalCode;
    }
    if (updateData.deliveryCountry !== undefined) {
      merchandiserUpdateData.deliveryCountry = updateData.deliveryCountry;
    }
    if (updateData.secondaryResidence !== undefined) {
      merchandiserUpdateData.secondaryResidence = updateData.secondaryResidence;
    }
    if (updateData.secondaryPostalCode !== undefined) {
      merchandiserUpdateData.secondaryZipCode = updateData.secondaryPostalCode;
    }
    if (updateData.secondaryCountry !== undefined) {
      merchandiserUpdateData.secondaryCountry = updateData.secondaryCountry;
    }
    if (updateData.taxId) {
      merchandiserUpdateData.tax_id = updateData.taxId;
    }
    if (updateData.taxNumber) {
      merchandiserUpdateData.tax_no = updateData.taxNumber;
    }

    // Handle city update — prefer free-text cityName over stale city.id
    if (updateData.cityName?.trim()) {
      const city = await this.citiesService.findOrCreateByName(
        updateData.cityName.trim(),
        updateData.country || updateData.nationality,
      );
      if (city) {
        merchandiserUpdateData.city = city;
      }
    } else if (updateData.city?.id) {
      const city = await this.citiesService.findById(updateData.city.id);
      if (city) {
        merchandiserUpdateData.city = city;
      }
    }

    // Handle status update
    if (updateData.status) {
      const statuses = await this.merchandiserStatusesService.findAllWithPagination({
        paginationOptions: { page: 1, limit: 1000 }
      });
      const status = statuses.data.find(s => s.name === updateData.status);
      if (status) {
        merchandiserUpdateData.status = status;
      }
    }

    // Update merchandiser basic data
    if (Object.keys(merchandiserUpdateData).length > 0) {
      await this.merchandiserRepository.update(id, merchandiserUpdateData);
    }

    // Handle job types with comments
    // Only update job types if explicitly provided with data (not an empty array)
    if (updateData.jobTypes && Array.isArray(updateData.jobTypes) && updateData.jobTypes.length > 0) {
      
      // Get existing job types
      const existingJobTypes = await this.merchandiserJobTypesService.findByMerchandiserId(id);
      const existingJobTypeIds = new Set(existingJobTypes.map(jt => jt.id));
      
      // Process each job type
      for (const jobTypeData of updateData.jobTypes) {
        if (jobTypeData.id && jobTypeData.id !== null) {
          // Update existing job type - we need to provide the merchandiser reference
          const existingJobType = existingJobTypes.find(jt => jt.id === jobTypeData.id);
          if (existingJobType) {
            try {
              await this.merchandiserJobTypesService.update(jobTypeData.id, {
                merchandiser: merchandiser,
                jobType: { id: jobTypeData.jobTypeId },
                comment: jobTypeData.comment || null,
              });
              existingJobTypeIds.delete(jobTypeData.id);
            } catch (error) {
              console.error('❌ Error updating job type:', jobTypeData.id, error);
              throw error;
            }
          }
        } else {
          // Create new job type
          try {
            await this.merchandiserJobTypesService.create({
              merchandiser: merchandiser,
              jobType: { id: jobTypeData.jobTypeId },
              comment: jobTypeData.comment || null,
            });
          } catch (error) {
            console.error('❌ Error creating job type:', error);
            throw error;
          }
        }
      }
      
      // Remove job types that are no longer in the list
      for (const jobTypeId of existingJobTypeIds) {
        await this.merchandiserJobTypesService.remove(jobTypeId);
      }
    } else if (updateData.specializations !== undefined && Array.isArray(updateData.specializations)) {
      // Auto-sync job types with specializations if job types not explicitly provided
      
      if (updateData.specializations.length > 0) {
        const specializationIds = updateData.specializations.map(s => s.specializationTypeId);
        const specializations = await this.specializationRepository.findByIds(specializationIds);
        
        // Get unique job type IDs that should exist based on specializations
        const requiredJobTypeIds = [...new Set(specializations.map(s => s.jobType?.id).filter(id => id !== undefined))];
        
        
        // Get existing job types for this merchandiser
        const existingJobTypes = await this.merchandiserJobTypesService.findByMerchandiserId(id);
        const existingJobTypeMap = new Map(existingJobTypes.map(jt => [jt.jobType.id, jt.id]));
        
        // Add new job types that don't exist yet
        for (const jobTypeId of requiredJobTypeIds) {
          if (!existingJobTypeMap.has(jobTypeId)) {
            await this.merchandiserJobTypesService.create({
              merchandiser: merchandiser,
              jobType: { id: jobTypeId },
              comment: null,
            });
          }
        }
        
        // Remove job types that are no longer needed (not in any specialization)
        const requiredJobTypeSet = new Set(requiredJobTypeIds);
        for (const [jobTypeId, merchandiserJobTypeId] of existingJobTypeMap.entries()) {
          if (!requiredJobTypeSet.has(jobTypeId)) {
            await this.merchandiserJobTypesService.remove(merchandiserJobTypeId);
          }
        }
      } else {
        // If specializations array is empty, remove all job types
        const existingJobTypes = await this.merchandiserJobTypesService.findByMerchandiserId(id);
        for (const jobType of existingJobTypes) {
          await this.merchandiserJobTypesService.remove(jobType.id);
        }
      }
    }

    // Handle contractuals
    if (updateData.contractuals && Array.isArray(updateData.contractuals)) {
      
      const contractualIds = updateData.contractuals.map(c => c.id);
      const contractuals = await this.contractualsService.findByIds(contractualIds);
      
      await this.merchandiserRepository.update(id, {
        contractuals,
      });
    }

    // Handle specializations
    if (updateData.specializations && Array.isArray(updateData.specializations)) {
      
      // Remove existing specializations
      const existingSpecializations = await this.merchandiserSpecializationsRepository.findByMerchandiserId(id);
      for (const existingSpec of existingSpecializations) {
        await this.merchandiserSpecializationsRepository.remove(existingSpec.id);
      }
      
      // Add new specializations
      for (const specData of updateData.specializations) {
        // Find specialization by name and job type
        const specializations = await this.specializationRepository.findAllWithPagination({
          paginationOptions: { page: 1, limit: 1000 }
        });
        
        const specialization = specializations.data.find(s => 
          s.name === specData.name && 
          s.jobType?.name === specData.jobTypeName
        );
        
        if (specialization) {
          await this.merchandiserSpecializationsRepository.create({
            merchandiser: merchandiser,
            specialization: specialization,
          });
        }
      }
    }

    // Handle education
    if (updateData.education && Array.isArray(updateData.education)) {
      
      // Get existing education
      const existingEducation = await this.merchandiserEducationRepository.findByMerchandiserId(id);
      const existingEducationIds = new Set(existingEducation.map(edu => edu.id));
      
      // Process each education item
      for (const eduData of updateData.education) {
        if (eduData.id && eduData.id !== null) {
          // Update existing education
          try {
            await this.merchandiserEducationRepository.update(eduData.id, {
              merchandiser: merchandiser,
              company: eduData.institution,
              activity: eduData.qualification,
              graduationDate: new Date(eduData.graduationDate),
            });
            existingEducationIds.delete(eduData.id);
          } catch (error) {
            console.error('❌ Error updating education item:', eduData.id, error);
            throw error;
          }
        } else {
          // Create new education
          try {
            await this.merchandiserEducationRepository.create({
              merchandiser: merchandiser,
              company: eduData.institution,
              activity: eduData.qualification,
              graduationDate: new Date(eduData.graduationDate),
            });
          } catch (error) {
            console.error('❌ Error creating education item:', error);
            throw error;
          }
        }
      }
      
      // Remove education items that are no longer in the list
      for (const eduId of existingEducationIds) {
        await this.merchandiserEducationRepository.remove(eduId);
      }
    }

    // Handle references
    if (updateData.references && Array.isArray(updateData.references)) {
      
      // Get existing references
      const existingReferences = await this.merchandiserReferencesRepository.findByMerchandiserId(id);
      const existingReferenceIds = new Set(existingReferences.map(ref => ref.id));
      
      // Process each reference item
      for (const refData of updateData.references) {
        if (refData.id && refData.id !== null) {
          // Update existing reference
          try {
            await this.merchandiserReferencesRepository.update(refData.id, {
              merchandiser: merchandiser,
              company: refData.company,
              activity: refData.activity,
              branche: refData.industry ?? refData.branche,
              startDate: refData.fromDate ? new Date(refData.fromDate) : null,
              endDate: refData.toDate ? new Date(refData.toDate) : null,
            });
            existingReferenceIds.delete(refData.id);
          } catch (error) {
            console.error('❌ Error updating reference item:', refData.id, error);
            throw error;
          }
        } else {
          // Create new reference
          try {
            await this.merchandiserReferencesRepository.create({
              merchandiser: merchandiser,
              company: refData.company,
              activity: refData.activity,
              branche: refData.industry ?? refData.branche,
              startDate: refData.fromDate ? new Date(refData.fromDate) : null,
              endDate: refData.toDate ? new Date(refData.toDate) : null,
            });
          } catch (error) {
            console.error('❌ Error creating reference item:', error);
            throw error;
          }
        }
      }
      
      // Remove reference items that are no longer in the list
      for (const refId of existingReferenceIds) {
        await this.merchandiserReferencesRepository.remove(refId);
      }
    }

    // Handle languages
    if (updateData.languages && Array.isArray(updateData.languages)) {
      
      // Get existing languages
      const existingLanguages = await this.merchandiserLanguagesRepository.findByMerchandiserId(id);
      const existingLanguageIds = new Set(existingLanguages.map(lang => lang.id));
      
      // Process each language item
      for (const langData of updateData.languages) {
        
        if (langData.id && langData.id !== null) {
          // Update existing language
          try {
            // Find the language and level entities
            const language = await this.languagesRepository.findById(langData.languageId);
            if (!language) {
              console.error('❌ Language not found:', langData.languageId);
              continue;
            }
            
            await this.merchandiserLanguagesRepository.update(langData.id, {
              merchandiser: merchandiser,
              language: language,
              level: this.mapLevelIdToLanguageLevel(langData.levelId),
            });
            existingLanguageIds.delete(langData.id);
          } catch (error) {
            console.error('❌ Error updating language item:', langData.id, error);
            throw error;
          }
        } else {
          // Create new language
          try {
            // Find the language entity
            const language = await this.languagesRepository.findById(langData.languageId);
            if (!language) {
              console.error('❌ Language not found:', langData.languageId);
              continue;
            }
            
            const mappedLevel = this.mapLevelIdToLanguageLevel(langData.levelId);
            
            const result = await this.merchandiserLanguagesRepository.create({
              merchandiser: merchandiser,
              language: language,
              level: mappedLevel,
            });
          } catch (error) {
            console.error('❌ Error creating language item:', error);
            throw error;
          }
        }
      }
      
      // Remove language items that are no longer in the list
      for (const langId of existingLanguageIds) {
        await this.merchandiserLanguagesRepository.remove(langId);
      }
    }

    
    // FINAL STEP: Always sync job types with current specializations
    // This ensures job types are always in sync, even if specializations weren't just updated
    const currentSpecializations = await this.merchandiserSpecializationsRepository.findByMerchandiserId(id);
    
    if (currentSpecializations.length > 0) {
      // Get job type IDs from current specializations
      const requiredJobTypeIds = [...new Set(
        currentSpecializations
          .map(ms => ms.specialization?.jobType?.id)
          .filter(id => id !== undefined)
      )];
      
      
      // Get existing job types
      const existingJobTypes = await this.merchandiserJobTypesService.findByMerchandiserId(id);
      const existingJobTypeMap = new Map(existingJobTypes.map(jt => [jt.jobType.id, jt.id]));
      
      // Add missing job types
      for (const jobTypeId of requiredJobTypeIds) {
        if (!existingJobTypeMap.has(jobTypeId)) {
          await this.merchandiserJobTypesService.create({
            merchandiser: merchandiser,
            jobType: { id: jobTypeId },
            comment: null,
          });
        }
      }
      
      // Remove job types that are no longer needed
      const requiredJobTypeSet = new Set(requiredJobTypeIds);
      for (const [jobTypeId, merchandiserJobTypeId] of existingJobTypeMap.entries()) {
        if (!requiredJobTypeSet.has(jobTypeId)) {
          await this.merchandiserJobTypesService.remove(merchandiserJobTypeId);
        }
      }
      
    } else {
      // No specializations = no job types needed
      const existingJobTypes = await this.merchandiserJobTypesService.findByMerchandiserId(id);
      if (existingJobTypes.length > 0) {
        for (const jobType of existingJobTypes) {
          await this.merchandiserJobTypesService.remove(jobType.id);
        }
      }
    }
    
    // Return the updated merchandiser with all relations and email status
    const updatedMerchandiser = await this.findByIdWithRelations(id);
    return {
      ...updatedMerchandiser,
      emailUpdated: emailChanged,
      welcomeEmailSent,
    };
  }

  remove(id: Merchandiser['id']) {
    return this.merchandiserRepository.remove(id);
  }

  async merchandiserRegister(i18n: any) {
    const data: any = {};
    try {
      const countries = await this.countriesRepository.findAllWithPagination({
        paginationOptions: { page: 1, limit: 0 },
        i18n: i18n.lang,
      });
      if (!countries || !countries.data || countries.data.length === 0) {
        throw new UnprocessableEntityException({
          status: HttpStatus.UNPROCESSABLE_ENTITY,
          errors: {
            countries: 'No countries found',
          },
        });
      }
      data.countries = countries.data;

      const jobTypes = await this.jobTypesRepository.findAllWithPagination({
        paginationOptions: { page: 1, limit: 0 },
      });
      if (!jobTypes || !jobTypes.data || jobTypes.data.length === 0) {
        throw new UnprocessableEntityException({
          status: HttpStatus.UNPROCESSABLE_ENTITY,
          errors: {
            jobTypes: 'No job types found',
          },
        });
      }
      data.jobTypes = jobTypes.data;
    } catch (error) {
      console.error(error);
      throw new UnprocessableEntityException({
        status: HttpStatus.UNPROCESSABLE_ENTITY,
        errors: {
          message: error.message || 'An error occurred while fetching the data',
        },
      });
    }

    return data;
  }

  async merchandiserProfile(userJwtPayload: JwtPayloadType, i18n: any) {
    const data: any = {};
    try {

      // If user is provided, get their profile data
      if (userJwtPayload && userJwtPayload.id) {
        const userId = parseInt(userJwtPayload.id.toString(), 10);

        if (isNaN(userId)) {
          throw new UnprocessableEntityException({
            status: HttpStatus.UNPROCESSABLE_ENTITY,
            errors: {
              user: 'Invalid user ID',
            },
          });
        }

        const currentUser = await this.usersService.findById(userId);

        if (currentUser) {
          // Get the merchandiser profile with all relations
          const merchandiser = await this.merchandiserRepository.findByUserId(userId);

          // Get merchandiser's languages
          const merchandiserLanguages = merchandiser ?
            await this.merchandiserLanguagesRepository.findByMerchandiserId(merchandiser.id) : [];

          // Get merchandiser's specializations
          const merchandiserSpecializations = merchandiser ?
            await this.merchandiserSpecializationsRepository.findByMerchandiserId(merchandiser.id) : [];

          // Get merchandiser's references
          const merchandiserReferences = merchandiser ?
            await this.merchandiserReferencesRepository.findByMerchandiserId(merchandiser.id) : [];

          // Get merchandiser's education
          const merchandiserEducation = merchandiser ?
            await this.merchandiserEducationRepository.findByMerchandiserId(merchandiser.id) : [];

          // Get merchandiser files
          const merchandiserFiles = merchandiser ? await this.merchandiserFilesService.findByMerchandiserId(merchandiser.id) : [];

          // Get merchandiser job types with comments
          const merchandiserJobTypes = merchandiser ? await this.merchandiserJobTypesService.findByMerchandiserId(merchandiser.id) : [];

          // Prepare clean profile data WITHOUT sensitive information
          const profileData = {
            // User basic info (without password and other sensitive data)
            id: currentUser.id,
            firstName: currentUser.firstName,
            lastName: currentUser.lastName,
            email: currentUser.email,
            gender: currentUser.gender,
            phoneNumber: currentUser.phone, // Map phone to phoneNumber for frontend

            // Merchandiser info
            birthDate: merchandiser?.birthday,
            website: merchandiser?.website,
            postalCode: merchandiser?.zipCode, // Map zipCode to postalCode for frontend
            nationality: merchandiser?.nationality,

            // City and country info
            countryId: merchandiser?.city?.country?.id || null,
            cityId: merchandiser?.city?.id || null,
            cityName: merchandiser?.city?.name || null,

            // Related data
            languages: merchandiserLanguages.map(ml => ({
              id: ml.id,
              languageId: ml.language?.id,
              levelId: this.mapLanguageLevelToId(ml.level),
              language: ml.language ? {
                id: ml.language.id,
                name: ml.language.name
                // Remove reference to non-existent code field
              } : null
            })),

            jobTypes: merchandiserJobTypes.map(mjt => ({
              id: mjt.id,
              jobTypeId: mjt.jobType?.id,
              name: mjt.jobType?.name,
              comment: mjt.comment
            })),

            contractuals: merchandiser?.contractuals ? merchandiser.contractuals.map(c => ({
              id: c.id,
              contractualId: c.id,
              name: c.name
            })) : [],

            specializations: merchandiserSpecializations.map(ms => ({
              id: ms.id,
              specializationTypeId: ms.specialization?.id,
              specialization: ms.specialization ? {
                id: ms.specialization.id,
                name: ms.specialization.name
                // Remove reference to non-existent category field
              } : null
            })),

            references: merchandiserReferences.map(ref => ({
              id: ref.id,
              company: ref.company,
              activity: ref.activity,
              industry: ref.branche, // Map branche to industry for frontend
              fromDate: ref.startDate,
              toDate: ref.endDate
            })),

            education: merchandiserEducation.map(edu => ({
              id: edu.id,
              institution: edu.company, // Map company to institution for frontend
              qualification: edu.activity, // Map activity to qualification for frontend
              graduationDate: edu.graduationDate // Use the actual graduation date from the entity
            })),

            files: merchandiserFiles
          };

          data.profile = profileData;
        }
      }

      // Fetch countries
      const countries = await this.countriesRepository.findAllWithPagination({
        paginationOptions: { page: 1, limit: 0 },
        i18n: i18n.lang,
      });

      // Clean up countries data (allow empty list if none found)
      data.countries = (countries?.data || []).map(country => ({
        id: country.id,
        name: typeof country.name === 'object' ? country.name[i18n.lang] || country.name['de'] || 'Unknown' : country.name,
        flag: country.flag
      }));

      // Fetch cities - only for the merchandiser's selected country if available
      let cities: any[] = [];
      if (data.profile && data.profile.countryId) {
        // Fetch cities only for the selected country
        cities = await this.citiesService.findByCountryId(data.profile.countryId);
        // Clean up cities data
        data.cities = cities.map(city => ({
          id: city.id,
          name: city.name,
          countryId: city.country?.id || data.profile.countryId,
          country: city.country ? {
            id: city.country.id,
            name: typeof city.country.name === 'object' ?
              city.country.name[i18n.lang] || city.country.name['de'] || 'Unknown' :
              city.country.name
          } : null
        }));
      } else {
        // If no country selected, return empty cities array
        data.cities = [];
      }

      // Fetch ALL job types from database
      const allJobTypes = await this.jobTypesRepository.findAllWithPagination({
        paginationOptions: { page: 1, limit: 0 }
      });
      
      // Map all job types to include only necessary fields (allow empty if none found)
      data.jobTypes = (allJobTypes?.data || []).map(jobType => ({
        id: jobType.id,
        name: jobType.name
      }));

      // Fetch ALL specializations from database
      const allSpecializations = await this.specializationRepository.findAllWithPagination({
        paginationOptions: { page: 1, limit: 0 }
      });

      data.specializations = allSpecializations?.data || [];

      // Fetch languages
      const languages = await this.languagesRepository.findAllWithPagination({
        paginationOptions: { page: 1, limit: 0 }
      });

      data.languages = languages?.data || [];

      // Static industry types (you can move these to database later if needed)
      data.industryTypes = [
        { id: 1, name: 'Einzelhandel', value: 'retail' },
        { id: 2, name: 'Mode', value: 'fashion' },
        { id: 3, name: 'Möbel', value: 'furniture' },
        { id: 4, name: 'Elektronik', value: 'electronics' },
        { id: 5, name: 'Kosmetik', value: 'cosmetics' },
        { id: 6, name: 'Sport', value: 'sports' }
      ];

      // Language levels
      data.languageLevels = [
        { id: 1, name: 'Grundkenntnisse', code: 'beginner' },
        { id: 2, name: 'Mittlere Kenntnisse', code: 'intermediate' },
        { id: 3, name: 'Fortgeschrittene Kenntnisse', code: 'advanced' },
        { id: 4, name: 'Fließend', code: 'fluent' },
        { id: 5, name: 'Muttersprache', code: 'native' }
      ];

      // Gender options
      data.genderOptions = [
        { id: 'male', name: 'Herr' },
        { id: 'female', name: 'Frau' },
        { id: 'other', name: 'Divers' }
      ];

    } catch (error) {
      console.error(error);
      if (error instanceof UnprocessableEntityException || (error.status === HttpStatus.UNPROCESSABLE_ENTITY)) {
        throw error;
      }
      throw new UnprocessableEntityException({
        status: HttpStatus.UNPROCESSABLE_ENTITY,
        errors: {
          message: error.message || 'An error occurred while fetching the data',
        },
      });
    }

    return data;
  }

  async merchandiserProfileData(id: Merchandiser['id'], userJwtPayload: JwtPayloadType, i18n: any) {
    const data: any = {};
    try {
      const user = await this.usersService.findById(userJwtPayload.id);

      if (!user) {
        throw new UnprocessableEntityException({
          status: HttpStatus.UNPROCESSABLE_ENTITY,
          errors: {
            email: 'notFound',
          },
        });
      }
      // Check if user type is akzente
      if (user.type?.id !== UserTypeEnum.akzente) {
        throw new UnprocessableEntityException({
          status: HttpStatus.UNPROCESSABLE_ENTITY,
          errors: {
            userType: 'unauthorizedUserType',
          },
        });
      }

      // Get the merchandiser profile with all relations
      const merchandiser = await this.merchandiserRepository.findById(id);
      const merchandiserUser = merchandiser ? await this.usersService.findById(merchandiser.user.id) : null;
      if (!merchandiser || !merchandiserUser) {
        throw new UnprocessableEntityException({
          status: HttpStatus.UNPROCESSABLE_ENTITY,
          errors: {
            merchandiser: 'notFound',
          },
        });
      }

      // Run all independent queries in parallel for better performance
      const [
        merchandiserLanguages,
        merchandiserSpecializations,
        merchandiserReferences,
        merchandiserEducation,
        merchandiserFiles,
        reviewStats,
        reviews,
        merchandiserJobTypes,
        allLanguages,
        statuses,
        availableJobTypes,
      ] = await Promise.all([
        // Get merchandiser's languages
        merchandiser ? this.merchandiserLanguagesRepository.findByMerchandiserId(merchandiser.id) : Promise.resolve([]),
        // Get merchandiser's specializations
        merchandiser ? this.merchandiserSpecializationsRepository.findByMerchandiserId(merchandiser.id) : Promise.resolve([]),
        // Get merchandiser's references
        merchandiser ? this.merchandiserReferencesRepository.findByMerchandiserId(merchandiser.id) : Promise.resolve([]),
        // Get merchandiser's education
        merchandiser ? this.merchandiserEducationRepository.findByMerchandiserId(merchandiser.id) : Promise.resolve([]),
        // Get merchandiser files
        merchandiser ? this.merchandiserFilesService.findByMerchandiserId(merchandiser.id) : Promise.resolve([]),
        // Get review stats
        this.reviewService.getMerchandiserStats(merchandiser.id),
        // Get reviews
        this.reviewService.findByMerchandiserId(merchandiser.id),
        // Get merchandiser job types with comments
        merchandiser ? this.merchandiserJobTypesService.findByMerchandiserId(merchandiser.id) : Promise.resolve([]),
        // Get all available languages for frontend use (can be cached)
        this.languagesRepository.findAllWithPagination({
          paginationOptions: { page: 1, limit: 1000 }
        }),
        // Get statuses (can be cached)
        this.merchandiserStatusesService.findAllWithPagination({
          paginationOptions: { page: 1, limit: 0 },
        }),
        // Get all available job types for frontend use
        this.jobTypesService.findAllWithPagination({
          paginationOptions: { page: 1, limit: 1000 }
        }),
      ]);
      
      // Prepare clean profile data WITHOUT sensitive information
      const profileData = {
        // User basic info (without password and other sensitive data)
        id: merchandiserUser.id,
        firstName: merchandiserUser.firstName,
        lastName: merchandiserUser.lastName,
        email: merchandiserUser.email,
        gender: merchandiserUser.gender,
        phoneNumber: merchandiserUser.phone, // Map phone to phoneNumber for frontend

        // Merchandiser info
        birthDate: merchandiser?.birthday,
        website: merchandiser?.website,
        postalCode: merchandiser?.zipCode, // Map zipCode to postalCode for frontend
        nationality: merchandiser?.nationality,
        street: merchandiser?.street,
        zipCode: merchandiser?.zipCode,
        deliveryAddress: merchandiser?.deliveryStreet,
        deliveryPostalCode: merchandiser?.deliveryZipCode,
        deliveryCountry: merchandiser?.deliveryCountry,
        secondaryResidence: merchandiser?.secondaryResidence,
        secondaryPostalCode: merchandiser?.secondaryZipCode,
        secondaryCountry: merchandiser?.secondaryCountry,
        tax_id: merchandiser?.tax_id,
        tax_no: merchandiser?.tax_no,
        reviewStats: {
          averageRating: reviewStats.averageRating,
          reviewCount: reviewStats.reviewCount,
        },
        reviews,
        // City and country info
        countryId: merchandiser?.city?.country?.id || null,
        cityId: merchandiser?.city?.id || null,
        cityName: merchandiser?.city?.name || null,
        status: merchandiser?.status, // Add status field
        // Related data
        languages: merchandiserLanguages.map(ml => ({
          id: ml.id,
          languageId: ml.language?.id,
          levelId: this.mapLanguageLevelToId(ml.level),
          language: ml.language ? {
            id: ml.language.id,
            name: ml.language.name
            // Remove reference to non-existent code field
          } : null
        })),

        jobTypes: merchandiserJobTypes.map(mjt => ({
          id: mjt.id,
          jobTypeId: mjt.jobType?.id,
          name: mjt.jobType?.name,
          comment: mjt.comment
        })),

        contractuals: merchandiser?.contractuals ? merchandiser.contractuals.map(c => ({
          id: c.id,
          contractualId: c.id,
          name: c.name
        })) : [],

        specializations: merchandiserSpecializations.map(ms => ({
          id: ms.id,
          specialization: ms.specialization ? {
            id: ms.specialization.id,
            name: ms.specialization.name,
            jobType: ms.specialization.jobType ? {
              id: ms.specialization.jobType.id,
              name: ms.specialization.jobType.name,
            } : null
          } : null
        })),

        references: merchandiserReferences.map(ref => ({
          id: ref.id,
          company: ref.company,
          activity: ref.activity,
          industry: ref.branche, // Map branche to industry for frontend
          fromDate: ref.startDate,
          toDate: ref.endDate
        })),

        education: merchandiserEducation.map(edu => ({
          id: edu.id,
          institution: edu.company, // Map company to institution for frontend
          qualification: edu.activity, // Map activity to qualification for frontend
          graduationDate: edu.graduationDate // Use the actual graduation date from the entity
        })),

        files: merchandiserFiles
      };

      data.profile = profileData;

    // Language levels (static data, no need to query)
    data.languageLevels = [
      { id: 1, name: 'Grundkenntnisse', code: 'beginner' },
      { id: 2, name: 'Mittlere Kenntnisse', code: 'intermediate' },
      { id: 3, name: 'Fortgeschrittene Kenntnisse', code: 'advanced' },
      { id: 4, name: 'Fließend', code: 'fluent' },
      { id: 5, name: 'Muttersprache', code: 'native' }
    ];

    // Use languages, statuses, and job types from parallel queries
    data.languages = allLanguages.data.map(lang => ({
      id: lang.id,
      name: lang.name
    }));

    data.statuses = statuses.data;
    data.availableJobTypes = availableJobTypes.data.map(jt => ({
      id: jt.id,
      name: jt.name
    }));

  } catch(error) {
    console.error(error);
    if (error instanceof UnprocessableEntityException || (error.status === HttpStatus.UNPROCESSABLE_ENTITY)) {
      throw error;
    }
    throw new UnprocessableEntityException({
      status: HttpStatus.UNPROCESSABLE_ENTITY,
      errors: {
        message: error.message || 'An error occurred while fetching the data',
      },
    });
  }

    return data;
  }

  // Helper method to map language level enum to ID
  private mapLanguageLevelToId(level: LanguageLevel): number {
  const levelMap: { [key in LanguageLevel]: number } = {
    [LanguageLevel.BASIC]: 1,
    [LanguageLevel.INTERMEDIATE]: 2,
    [LanguageLevel.ADVANCED]: 3,
    [LanguageLevel.FLUENT]: 4,
    [LanguageLevel.NATIVE]: 5
  };
  return levelMap[level] || 1;
}

  // Helper method to map level ID to LanguageLevel enum
  private mapLevelIdToLanguageLevel(levelId: number): LanguageLevel {
    const levelMap: { [key: number]: LanguageLevel } = {
      1: LanguageLevel.BASIC,
      2: LanguageLevel.INTERMEDIATE,
      3: LanguageLevel.ADVANCED,
      4: LanguageLevel.FLUENT,
      5: LanguageLevel.NATIVE
    };
    return levelMap[levelId] || LanguageLevel.BASIC;
  }

  async updateMerchandiserProfile(userJwtPayload: JwtPayloadType, updateData: any, i18n: any) {
  try {
    if (!userJwtPayload || !userJwtPayload.id) {
      throw new UnprocessableEntityException({
        status: HttpStatus.UNPROCESSABLE_ENTITY,
        errors: { message: 'User not authenticated' },
      });
    }

    const userId = parseInt(userJwtPayload.id.toString(), 10);

    if (isNaN(userId)) {
      throw new UnprocessableEntityException({
        status: HttpStatus.UNPROCESSABLE_ENTITY,
        errors: { message: 'Invalid user ID' },
      });
    }

    // Get the current user
    const currentUser = await this.usersService.findById(userId);

    if (!currentUser) {
      throw new UnprocessableEntityException({
        status: HttpStatus.UNPROCESSABLE_ENTITY,
        errors: { message: 'User not found' },
      });
    }

    // Find the merchandiser profile
    const merchandiser = await this.merchandiserRepository.findByUserId(userId);

    if (!merchandiser) {
      throw new UnprocessableEntityException({
        status: HttpStatus.UNPROCESSABLE_ENTITY,
        errors: { message: 'Merchandiser profile not found' },
      });
    }

    // Prepare user update data
    const userUpdateData: any = {};

    if (updateData.firstName) userUpdateData.firstName = updateData.firstName;
    if (updateData.lastName) userUpdateData.lastName = updateData.lastName;
    if (updateData.email) userUpdateData.email = updateData.email;
    if (updateData.phoneNumber !== undefined) userUpdateData.phone = updateData.phoneNumber;

    // Handle gender field
    if (updateData.gender) {
      userUpdateData.gender = typeof updateData.gender === 'object' ? updateData.gender.id : updateData.gender;
    }

    // Handle password update
    if (updateData.password && updateData.password.trim()) {
      userUpdateData.password = updateData.password;
    }

    // Update user data
    if (Object.keys(userUpdateData).length > 0) {
      await this.usersService.update(userId, userUpdateData);
    }

    // Prepare merchandiser update data
    const merchandiserUpdateData: any = {};

    if (updateData.birthDate !== undefined) {
      // Handle empty string or null - set to null
      if (!updateData.birthDate || updateData.birthDate === '' || updateData.birthDate === null) {
        merchandiserUpdateData.birthday = null;
      } else {
        // Validate date before creating Date object
        const date = new Date(updateData.birthDate);
        if (isNaN(date.getTime())) {
          // Invalid date, set to null
          merchandiserUpdateData.birthday = null;
        } else {
          merchandiserUpdateData.birthday = date;
        }
      }
    }
    if (updateData.website !== undefined) merchandiserUpdateData.website = updateData.website;
    if (updateData.postalCode) merchandiserUpdateData.zipCode = updateData.postalCode;
    if (updateData.nationality !== undefined) merchandiserUpdateData.nationality = updateData.nationality;

    // Handle city — prefer free-text cityName over stale cityId
    if (updateData.cityName?.trim()) {
      const city = await this.citiesService.findOrCreateByName(
        updateData.cityName.trim(),
        updateData.nationality,
      );
      if (city) {
        merchandiserUpdateData.city = city;
      }
    } else if (updateData.cityId) {
      const city = await this.citiesRepository.findById(updateData.cityId);
      if (city) {
        merchandiserUpdateData.city = city;
      }
    }

    // Handle job types
    if (updateData.jobTypes && Array.isArray(updateData.jobTypes)) {
      const jobTypes = await this.jobTypesRepository.findByIds(updateData.jobTypes);
      merchandiserUpdateData.jobTypes = jobTypes;
    }

    // Update merchandiser data
    if (Object.keys(merchandiserUpdateData).length > 0) {
      await this.merchandiserRepository.update(merchandiser.id, merchandiserUpdateData);
    }

    // Handle Languages
    if (updateData.languages && Array.isArray(updateData.languages)) {
      // Remove existing languages for this merchandiser
      const existingLanguages = await this.merchandiserLanguagesRepository.findByMerchandiserId(merchandiser.id);
      for (const existingLang of existingLanguages) {
        await this.merchandiserLanguagesRepository.remove(existingLang.id);
      }

      // Add new languages
      for (const langData of updateData.languages) {
        if (langData.languageId && langData.levelId) {
          const language = await this.languagesRepository.findById(langData.languageId);
          if (language) {
            await this.merchandiserLanguagesRepository.create({
              merchandiser,
              language,
              level: this.mapLevelIdToLanguageLevel(langData.levelId),
            });
          }
        }
      }
    }

    // Handle Specializations
    if (updateData.specializations && Array.isArray(updateData.specializations)) {
      // Remove existing specializations for this merchandiser
      const existingSpecs = await this.merchandiserSpecializationsRepository.findByMerchandiserId(merchandiser.id);
      for (const existingSpec of existingSpecs) {
        await this.merchandiserSpecializationsRepository.remove(existingSpec.id);
      }

      // Add new specializations
      for (const specData of updateData.specializations) {
        if (specData.specializationTypeId || specData.specializationId) {
          const specializationId = specData.specializationTypeId || specData.specializationId;
          const specialization = await this.specializationRepository.findById(specializationId);
          if (specialization) {
            await this.merchandiserSpecializationsRepository.create({
              merchandiser,
              specialization,
            });
          }
        }
      }
    }

    // Handle References
    if (updateData.references && Array.isArray(updateData.references)) {
      const existingReferences = await this.merchandiserReferencesRepository.findByMerchandiserId(merchandiser.id);
      const existingReferenceIds = new Set(existingReferences.map((ref) => ref.id));

      for (const refData of updateData.references) {
        const hasContent =
          refData.company?.trim() ||
          refData.activity?.trim() ||
          refData.industry?.trim() ||
          refData.fromDate ||
          refData.toDate;

        if (!hasContent) {
          continue;
        }

        const referencePayload = {
          merchandiser,
          company: refData.company?.trim() || '',
          activity: refData.activity?.trim() || '',
          branche: refData.industry?.trim() || '',
          startDate: refData.fromDate ? new Date(refData.fromDate) : null,
          endDate: refData.toDate ? new Date(refData.toDate) : null,
        };

        if (refData.id && refData.id !== null) {
          await this.merchandiserReferencesRepository.update(refData.id, referencePayload);
          existingReferenceIds.delete(refData.id);
        } else {
          await this.merchandiserReferencesRepository.create(referencePayload);
        }
      }

      for (const refId of existingReferenceIds) {
        await this.merchandiserReferencesRepository.remove(refId);
      }
    }

    // Handle Education (Education)
    if (updateData.education && Array.isArray(updateData.education)) {
      const existingEducation = await this.merchandiserEducationRepository.findByMerchandiserId(merchandiser.id);
      const existingEducationIds = new Set(existingEducation.map((edu) => edu.id));

      for (const eduData of updateData.education) {
        const hasContent =
          eduData.institution?.trim() ||
          eduData.qualification?.trim() ||
          eduData.graduationDate;

        if (!hasContent) {
          continue;
        }

        const educationPayload = {
          merchandiser,
          company: eduData.institution?.trim() || '',
          activity: eduData.qualification?.trim() || '',
          graduationDate: eduData.graduationDate ? new Date(eduData.graduationDate) : null,
        };

        if (eduData.id && eduData.id !== null) {
          await this.merchandiserEducationRepository.update(eduData.id, educationPayload);
          existingEducationIds.delete(eduData.id);
        } else {
          await this.merchandiserEducationRepository.create(educationPayload);
        }
      }

      for (const eduId of existingEducationIds) {
        await this.merchandiserEducationRepository.remove(eduId);
      }
    }

    // FINAL STEP: Always sync job types with current specializations
    // This ensures job types are always in sync, even if specializations weren't just updated
    const currentSpecializations = await this.merchandiserSpecializationsRepository.findByMerchandiserId(merchandiser.id);
    
    if (currentSpecializations.length > 0) {
      // Get job type IDs from current specializations
      const requiredJobTypeIds = [...new Set(
        currentSpecializations
          .map(ms => ms.specialization?.jobType?.id)
          .filter(id => id !== undefined)
      )];
      
      
      // Get existing job types
      const existingJobTypes = await this.merchandiserJobTypesService.findByMerchandiserId(merchandiser.id);
      const existingJobTypeMap = new Map(existingJobTypes.map(jt => [jt.jobType.id, jt.id]));
      
      // Add missing job types
      for (const jobTypeId of requiredJobTypeIds) {
        if (!existingJobTypeMap.has(jobTypeId)) {
          await this.merchandiserJobTypesService.create({
            merchandiser: merchandiser,
            jobType: { id: jobTypeId },
            comment: null,
          });
        }
      }
      
      // Remove job types that are no longer needed
      const requiredJobTypeSet = new Set(requiredJobTypeIds);
      for (const [jobTypeId, merchandiserJobTypeId] of existingJobTypeMap.entries()) {
        if (!requiredJobTypeSet.has(jobTypeId)) {
          await this.merchandiserJobTypesService.remove(merchandiserJobTypeId);
        }
      }
      
    } else {
      // No specializations = no job types needed
      const existingJobTypes = await this.merchandiserJobTypesService.findByMerchandiserId(merchandiser.id);
      if (existingJobTypes.length > 0) {
        for (const jobType of existingJobTypes) {
          await this.merchandiserJobTypesService.remove(jobType.id);
        }
      }
    }

    return {
      success: true,
      message: 'Profile updated successfully',
      data: { userId: currentUser.id, merchandiserId: merchandiser.id }
    };

  } catch (error) {
    console.error('Error updating merchandiser profile:', error);

    if (error instanceof UnprocessableEntityException || (error.status === HttpStatus.UNPROCESSABLE_ENTITY)) {
      throw error;
    }

    throw new UnprocessableEntityException({
      status: HttpStatus.UNPROCESSABLE_ENTITY,
      errors: {
        message: error.message || 'An error occurred while updating the profile',
      },
    });
  }
}

  private mapLanguageLevel(levelId: number): LanguageLevel {
  const levelMap: { [key: number]: LanguageLevel } = {
    1: LanguageLevel.BASIC,
    2: LanguageLevel.INTERMEDIATE,
    3: LanguageLevel.ADVANCED,
    4: LanguageLevel.FLUENT,
    5: LanguageLevel.NATIVE
  };
  return levelMap[levelId] || LanguageLevel.BASIC;
}

  /**
   * Find all merchandisers with pagination and favorite status for a specific user
   */
  async findAllWithPaginationAndFavorites({
  paginationOptions,
  filters,
  sort,
  userId,
}: {
  paginationOptions: IPaginationOptions;
  filters?: FilterMerchandiserDto | null;
  sort?: SortMerchandiserDto[] | null;
  userId?: number;
}) {

  // Get merchandisers
  const merchandisersResult = await this.merchandiserRepository.findAllWithPagination({
    paginationOptions: {
      page: paginationOptions.page,
      limit: paginationOptions.limit,
    },
    filters,
    sort,
  });

  // Get portrait images for all merchandisers in a single batch query (much faster!)
  const merchandiserIds = merchandisersResult.data.map(m => m.id);
  let portraitsMap = new Map<number, any>();
  
  if (merchandiserIds.length > 0) {
    try {
      const portraitFiles = await this.merchandiserFilesService.findByMerchandiserIdsAndType(
        merchandiserIds,
        MerchandiserFileType.PORTRAIT
      );
      
      // Create a map of merchandiserId -> portrait file for quick lookup
      // The repository already groups by merchandiser ID, so we can directly map
      portraitFiles.forEach((portraitFile) => {
        // Try multiple ways to get the merchandiser ID
        const merchandiserId = portraitFile.merchandiser?.id || 
                              (portraitFile as any).merchandiser_id;
        if (merchandiserId && !portraitsMap.has(merchandiserId)) {
          // Only keep the first portrait if multiple exist
          portraitsMap.set(merchandiserId, portraitFile.file);
        }
      });
    } catch (error) {
      console.error('Error getting portraits in batch:', error);
    }
  }
  
  // Map merchandisers with their portraits
  const merchandisersWithPortraits = merchandisersResult.data.map((merchandiser) => ({
    ...merchandiser,
    portrait: portraitsMap.get(merchandiser.id) || null,
  }));

  if (!userId) {
    return {
      data: merchandisersWithPortraits.map(merchandiser => ({
        ...merchandiser,
        isFavorite: false,
      })),
      totalCount: merchandisersResult.totalCount,
    };
  }

  // Find user's akzente record directly (much faster than fetching all)
  const userAkzente = await this.akzenteService.findByUserId(userId);

  if (!userAkzente) {
    return {
      data: merchandisersWithPortraits.map(merchandiser => ({
        ...merchandiser,
        isFavorite: false,
      })),
      totalCount: merchandisersResult.totalCount,
    };
  }

  // Get user's favorite merchandisers
  const userFavorites = await this.akzenteFavoriteMerchandisersService.findByAkzenteId(userAkzente.id);
  const favoriteMerchandiserIds = new Set(userFavorites.map(fav => fav.merchandiser.id));


  // Add favorite status to each merchandiser
  const merchandisersWithFavorites = merchandisersWithPortraits.map(merchandiser => ({
    ...merchandiser,
    isFavorite: favoriteMerchandiserIds.has(merchandiser.id),
  }));

  return {
    data: merchandisersWithFavorites,
    totalCount: merchandisersResult.totalCount,
  };
}

  /**
   * Toggle favorite status for a merchandiser and user
   */
  async toggleFavoriteStatus(merchandiserId: number, userId: number) {

  // Find user's akzente record
  const allAkzente = await this.akzenteService.findAllWithPagination({
    paginationOptions: { page: 1, limit: 1000 }
  });
  const userAkzente = allAkzente.data.find(akzente => akzente.user.id === userId);

  if (!userAkzente) {
    throw new Error('Akzente profile not found for user');
  }

  // Check if merchandiser exists
  const merchandiser = await this.findById(merchandiserId);
  if (!merchandiser) {
    throw new Error('Merchandiser not found');
  }

  // Check if favorite already exists
  const existingFavorites = await this.akzenteFavoriteMerchandisersService.findByAkzenteId(userAkzente.id);
  const existingFavorite = existingFavorites.find(fav => fav.merchandiser.id === merchandiserId);

  if (existingFavorite) {
    // Remove from favorites
    await this.akzenteFavoriteMerchandisersService.remove(existingFavorite.id);
    return {
      isFavorite: false,
      message: 'Merchandiser Aus den Favoriten entfernt',
    };
  } else {
    // Add to favorites
    await this.akzenteFavoriteMerchandisersService.create({
      akzente: { id: userAkzente.id },
      merchandiser: { id: merchandiserId },
    });
    return {
      isFavorite: true,
      message: 'Merchandiser Zu den Favoriten hinzugefügt',
    };
  }
  }

  async getUserReports(userJwtPayload: JwtPayloadType) {

    // Handle both string and number user IDs
    const userId = typeof userJwtPayload.id === 'string' ? parseInt(userJwtPayload.id, 10) : userJwtPayload.id;
    
    if (!userJwtPayload?.id || isNaN(userId) || userId <= 0) {
      throw new Error('Invalid user ID provided');
    }

    // Find the merchandiser record for this user
    const merchandiser = await this.findByUserId(userJwtPayload);
    if (!merchandiser) {
      throw new Error('Merchandiser profile not found for user');
    }


    // Validate merchandiser ID
    if (!merchandiser.id || isNaN(Number(merchandiser.id))) {
      throw new Error('Invalid merchandiser ID found');
    }

    // Get all reports assigned to this merchandiser with favorite status
    const reports = await this.getReportsByMerchandiserId(merchandiser.id, userId);

    return reports;
  }

  async getReportsByMerchandiserId(merchandiserId: number, userId?: number) {
    // Use the ReportService to get reports assigned to this merchandiser
    const reports = await this.reportService.findByMerchandiserId(merchandiserId, userId);

    try {
      // Enrich with favorite status
      // We do this here to avoid circular dependency issues in ReportService
      const favorites = await this.merchandiserFavoriteReportsService.findByMerchandiserId(merchandiserId);
      const favoriteReportIds = new Set(favorites.map(f => f.report.id));
      
      return reports.map(report => ({
        ...report,
        isFavorite: favoriteReportIds.has(report.id)
      }));
    } catch (error) {
       console.error('Error fetching favorites for merchandiser in MerchandiserService:', error);
       // Fallback to no favorites if service fails
       return reports.map((report) => ({ ...report, isFavorite: false }));
    }
  }

  /**
   * Get client companies associated with the current merchandiser through their reports
   */
  async getClientCompaniesForUser(userJwtPayload: JwtPayloadType) {

    const userId = typeof userJwtPayload.id === 'string' ? parseInt(userJwtPayload.id, 10) : userJwtPayload.id;

    if (!userJwtPayload?.id || isNaN(userId) || userId <= 0) {
      throw new Error('Invalid user ID provided');
    }

    const merchandiser = await this.findByUserId(userJwtPayload);
    if (!merchandiser) {
      throw new Error('Merchandiser profile not found for user');
    }


    if (!merchandiser.id || isNaN(Number(merchandiser.id))) {
      throw new Error('Invalid merchandiser ID found');
    }

    // Get client company IDs from reports
    const clientCompanyIds = await this.reportService.getClientCompaniesByMerchandiserId(merchandiser.id);
    
    // Get full client company details
    const clientCompanies = await this.clientCompanyService.findByIds(clientCompanyIds);
    
    // Get report counts for this merchandiser's client companies
    const reportCountsMap = await this.getReportCountsForMerchandiserClientCompanies(merchandiser.id, clientCompanyIds);
    
    // Get favorite client companies for this merchandiser
    const favoriteClientCompanies = await this.merchandiserFavoriteClientCompanyService.findByMerchandiserId(merchandiser.id);
    const favoriteClientCompanyIds = favoriteClientCompanies.map(fav => fav.clientCompany.id);
    
    // Add report counts and favorite status to each client company
    const clientCompaniesWithCounts = clientCompanies.map(company => {
      const reportCounts = reportCountsMap.get(company.id) || { newReports: 0, ongoingReports: 0, completedReports: 0 };
      const isFavorite = favoriteClientCompanyIds.includes(company.id);
      return {
        ...company,
        reportCounts,
        isFavorite,
      };
    });
    
    return clientCompaniesWithCounts;
  }

  /**
   * Get report counts for client companies that this merchandiser is working on
   */
  private async getReportCountsForMerchandiserClientCompanies(
    merchandiserId: number, 
    clientCompanyIds: number[]
  ): Promise<Map<number, { newReports: number; ongoingReports: number; completedReports: number }>> {
    if (!clientCompanyIds || clientCompanyIds.length === 0) {
      return new Map();
    }

    try {

      // Get all reports for this merchandiser
      const merchandiserReports = await this.reportService.findByMerchandiserId(merchandiserId);
      
      // Initialize counts map
      const reportCountsMap = new Map<number, { newReports: number; ongoingReports: number; completedReports: number }>();
      clientCompanyIds.forEach(clientCompanyId => {
        reportCountsMap.set(clientCompanyId, { newReports: 0, ongoingReports: 0, completedReports: 0 });
      });

      // Count reports by client company and status category
      merchandiserReports.forEach(report => {
        const clientCompanyId = report.clientCompany.id;
        const statusId = report.status.id;
        
        // Only count if this client company is in our list
        if (clientCompanyIds.includes(clientCompanyId)) {
          const counts = reportCountsMap.get(clientCompanyId);
          if (counts) {
            const category = categorizeReportCount(statusId, 'merchandiser');
            if (category === 'new') {
              counts.newReports++;
            } else if (category === 'completed') {
              counts.completedReports++;
            } else if (category === 'ongoing') {
              counts.ongoingReports++;
            }
          }
        }
      });

      return reportCountsMap;
    } catch (error) {
      console.error('❌ Error getting report counts for merchandiser client companies:', error);
      // Return empty counts map on error
      const emptyCountsMap = new Map<number, { newReports: number; ongoingReports: number; completedReports: number }>();
      clientCompanyIds.forEach(clientCompanyId => {
        emptyCountsMap.set(clientCompanyId, { newReports: 0, ongoingReports: 0, completedReports: 0 });
      });
      return emptyCountsMap;
    }
  }

  /**
   * Get report counts for merchandiser's projects
   */
  private async getReportCountsForMerchandiserProjects(
    merchandiserId: number, 
    projectIds: number[]
  ): Promise<Map<number, { newReports: number; ongoingReports: number; completedReports: number }>> {
    if (!projectIds || projectIds.length === 0) {
      return new Map();
    }

    try {

      // Get all reports for this merchandiser
      const merchandiserReports = await this.reportService.findByMerchandiserId(merchandiserId);
      
      // Initialize counts map
      const reportCountsMap = new Map<number, { newReports: number; ongoingReports: number; completedReports: number }>();
      projectIds.forEach(projectId => {
        reportCountsMap.set(projectId, { newReports: 0, ongoingReports: 0, completedReports: 0 });
      });

      // Count reports by project and status category
      merchandiserReports.forEach(report => {
        const projectId = report.project.id;
        const statusId = report.status.id;
        
        // Only count if this project is in our list
        if (projectIds.includes(projectId)) {
          const counts = reportCountsMap.get(projectId);
          if (counts) {
            const category = categorizeReportCount(statusId, 'merchandiser');
            if (category === 'new') {
              counts.newReports++;
            } else if (category === 'completed') {
              counts.completedReports++;
            } else if (category === 'ongoing') {
              counts.ongoingReports++;
            }
          }
        }
      });

      return reportCountsMap;
    } catch (error) {
      console.error('❌ Error getting report counts for merchandiser projects:', error);
      // Return empty counts map on error
      const emptyCountsMap = new Map<number, { newReports: number; ongoingReports: number; completedReports: number }>();
      projectIds.forEach(projectId => {
        emptyCountsMap.set(projectId, { newReports: 0, ongoingReports: 0, completedReports: 0 });
      });
      return emptyCountsMap;
    }
  }

  async getUserFavorites(userJwtPayload: JwtPayloadType) {
    // Validate userId
    const userId = Number(userJwtPayload?.id);
    if (!userJwtPayload?.id || isNaN(userId) || userId <= 0) {
      throw new Error('Invalid user ID provided');
    }

    // Find the merchandiser record for this user
    const merchandiser = await this.findByUserId(userJwtPayload);
    if (!merchandiser) {
      // Return empty favorites if user doesn't have a merchandiser profile
      // This handles cases where user is not a merchandiser or hasn't created profile yet
      return {
        favoriteReports: [],
        favoriteProjects: [],
      };
    }

    // Get favorite reports (missions)
    const favoriteReports = await this.merchandiserFavoriteReportsService.findByMerchandiserId(merchandiser.id);
    const reports = favoriteReports.map(fav => fav.report);

    // Get favorite projects
    const favoriteProjects = await this.merchandiserFavoriteProjectService.findByMerchandiserId(merchandiser.id);
    const projects = favoriteProjects.map(fav => fav.project);

    // Get report counts for favorite projects
    const projectIds = projects.map(project => project.id);
    const reportCountsMap = await this.getReportCountsForMerchandiserProjects(merchandiser.id, projectIds);

    // Get unique client company IDs from both reports and projects
    const clientCompanyIds = new Set<number>();
    reports.forEach(report => {
      if (report.clientCompany?.id) {
        clientCompanyIds.add(report.clientCompany.id);
      }
    });
    projects.forEach(project => {
      if (project.clientCompany?.id) {
        clientCompanyIds.add(project.clientCompany.id);
      }
    });

    // Get client assignments for all client companies
    const clientAssignmentsMap = new Map<number, any[]>();
    for (const clientCompanyId of clientCompanyIds) {
      const assignments = await this.clientCompanyAssignedClientService.findByClientCompanyId(clientCompanyId);
      clientAssignmentsMap.set(clientCompanyId, assignments);
    }

    // Add client information to favorite reports
    const reportsWithClients = reports.map(report => {
      const clientAssignments = clientAssignmentsMap.get(report.clientCompany?.id) || [];
      return {
        ...report,
        clients: clientAssignments.map(assignment => assignment.client),
      };
    });

    // Add report counts and client information to each favorite project
    const projectsWithCountsAndClients = projects.map(project => {
      const reportCounts = reportCountsMap.get(project.id) || { newReports: 0, ongoingReports: 0, completedReports: 0 };
      const clientAssignments = clientAssignmentsMap.get(project.clientCompany?.id) || [];
      return {
        ...project,
        reportCounts,
        clients: clientAssignments.map(assignment => assignment.client),
      };
    });

    return {
      favoriteReports: reportsWithClients,
      favoriteProjects: projectsWithCountsAndClients,
    };
  }

  async findByFullName(fullName: string) {
    return this.merchandiserRepository.findByFullName(fullName);
  }

  /**
   * Get assigned reports grouped by project for the current merchandiser
   */
  async getAssignedReportsGroupedByProject(userJwtPayload: JwtPayloadType) {

    const userId = typeof userJwtPayload.id === 'string' ? parseInt(userJwtPayload.id, 10) : userJwtPayload.id;

    if (!userJwtPayload?.id || isNaN(userId) || userId <= 0) {
      throw new Error('Invalid user ID provided');
    }

    const merchandiser = await this.findByUserId(userJwtPayload);
    if (!merchandiser) {
      throw new Error('Merchandiser profile not found for user');
    }


    if (!merchandiser.id || isNaN(Number(merchandiser.id))) {
      throw new Error('Invalid merchandiser ID found');
    }

    // Get all reports for this merchandiser that are not yet accepted
    const allReports = await this.reportService.findByMerchandiserId(merchandiser.id);
    
    const assignedReports = allReports.filter(
      (report) => report.accepted === false,
    );

    // Group reports by project
    const reportsByProject = new Map<number, any[]>();
    
    assignedReports.forEach(report => {
      const projectId = report.project.id;
      if (!reportsByProject.has(projectId)) {
        reportsByProject.set(projectId, []);
      }
      reportsByProject.get(projectId)!.push(report);
    });

    // Get favorite projects for this merchandiser
    const favoriteProjects = await this.merchandiserFavoriteProjectService.findByMerchandiserId(merchandiser.id);
    const favoriteProjectIds = favoriteProjects.map(fav => fav.project.id);

    // Convert to array format with project information
    const groupedReports = Array.from(reportsByProject.entries()).map(([projectId, reports]) => {
      const firstReport = reports[0]; // All reports in this group have the same project
      const isFavorite = favoriteProjectIds.includes(projectId);
      
      return {
        project: {
          id: firstReport.project.id,
          name: firstReport.project.name,
          startDate: firstReport.project.startDate,
          endDate: firstReport.project.endDate,
          createdAt: firstReport.project.createdAt,
          updatedAt: firstReport.project.updatedAt,
          clientCompany: firstReport.project.clientCompany,
          isFavorite
        },
        reports: reports.map(report => ({
          id: report.id,
          title: report.title,
          description: report.description,
          status: report.status,
          branch: report.branch,
          merchandiser: report.merchandiser,
          street: report.street,
          zipCode: report.zipCode,
          plannedOn: report.plannedOn,
          note: report.note,
          reportTo: report.reportTo,
          feedback: report.feedback,
          accepted: report.accepted,
          createdAt: report.createdAt,
          updatedAt: report.updatedAt
        })),
        reportCount: reports.length
      };
    });

    return groupedReports;
  }

  /**
   * Get dashboard data for the current merchandiser
   * Optimized endpoint that returns all dashboard data in one call
   */
  async getDashboardData(userJwtPayload: JwtPayloadType, request?: any) {
    const startTime = Date.now();

    const userId = typeof userJwtPayload.id === 'string' ? parseInt(userJwtPayload.id, 10) : userJwtPayload.id;

    if (!userJwtPayload?.id || isNaN(userId) || userId <= 0) {
      throw new Error('Invalid user ID provided');
    }

    // Get merchandiser profile
    const merchandiser = await this.findByUserId(userJwtPayload);
    if (!merchandiser) {
      throw new Error('Merchandiser profile not found for user');
    }

    // Fetch all data in parallel for better performance
    // Use optimized dashboard query that:
    // 1. Filters by status at database level (only NEW, ASSIGNED, DUE) - reduces data transfer significantly
    // 2. Only loads essential fields - reduces memory usage
    // 3. Has a limit of 500 records - prevents excessive data loading
    // 4. Uses database indexes for optimal performance (see migration AddReportDashboardIndexes)
    // 5. Gets favorites separately to avoid circular dependency in ReportService
    const [reportsRaw, favoriteProjects, favoriteReports] = await Promise.all([
      this.reportService.findDashboardReportsByMerchandiserId(merchandiser.id),
      this.merchandiserFavoriteProjectService.findByMerchandiserId(merchandiser.id),
      this.merchandiserFavoriteReportsService.findByMerchandiserId(merchandiser.id).catch(e => {
          console.error('Error fetching favorite reports for dashboard:', e);
          return [];
      }),
    ]);

    // Efficiently map favorite status
    const favoriteReportIds = new Set(favoriteReports.map(f => f.report.id));
    const allReports = reportsRaw.map(report => ({
        ...report,
        isFavorite: favoriteReportIds.has(report.id)
    }));

    const favoriteProjectIds = new Set(favoriteProjects.map(fav => fav.project.id));
    const now = new Date();
    const upcomingProjects: any[] = [];
    const newRequests: any[] = [];
    const overdueReports: any[] = [];

    // Process all reports in a single pass for efficiency
    allReports.forEach((report) => {
      const statusId = report.status?.id;

      // Extract upcoming projects (future dates with scheduled status)
      if (report.plannedOn && statusId === ReportStatusEnum.SCHEDULED) {
        const plannedDate = new Date(report.plannedOn);
        if (plannedDate >= now) {
          upcomingProjects.push({
            id: report.id,
            date: report.plannedOn,
            clientCompany: report.project?.clientCompany?.name || 'Unbekannt',
            projectName: report.project?.name || 'Unbekannt',
          });
        }
      }

      // Overdue: scheduled visits in the past that are not yet submitted
      if (
        statusId === ReportStatusEnum.SCHEDULED &&
        report.plannedOn &&
        new Date(report.plannedOn) < now
      ) {
        overdueReports.push(report);
      }

      // Build "Neue Anfragen" from reports pending merchandiser acceptance.
      if (report.accepted === false) {
        newRequests.push({
          id: report.id,
          createdAt: report.createdAt,
          branch: report.branch,
          status: report.status,
          note: report.note,
          accepted: report.accepted,
        });
      }
    });

    // Sort upcoming projects by date (earliest first)
    upcomingProjects.sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());

    // Sort new requests by creation date (newest first)
    newRequests.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

    const endTime = Date.now();

    return {
      upcomingProjects: upcomingProjects.slice(0, 3), // Top 3 upcoming
      upcomingProjectsCount: upcomingProjects.length,
      newRequestsCount: newRequests.length,
      newRequests: newRequests.slice(0, 3), // Top 3 new requests
      overdueReports,
    };
  }

  private isAnfrageReport(report: any): boolean {
    const status = report?.status;
    const statusId = status?.id;
    const normalizedName = (status?.name || '').toString().trim().toLowerCase();
    const normalizedMerchandiserName = (status?.merchandiserName || '')
      .toString()
      .trim()
      .toLowerCase();
    const normalizedClientName = (status?.clientName || '')
      .toString()
      .trim()
      .toLowerCase();

    return (
      normalizedName === 'anfrage' ||
      normalizedMerchandiserName === 'anfrage' ||
      normalizedClientName === 'anfrage' ||
      report?.accepted === false
    );
  }
}
