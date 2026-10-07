import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, In, SelectQueryBuilder } from 'typeorm';
import { MerchandiserEntity } from '../entities/merchandiser.entity';
import { NullableType } from '../../../../../utils/types/nullable.type';
import { Merchandiser } from '../../../../domain/merchandiser';
import { MerchandiserRepository } from '../../merchandiser.repository';
import { MerchandiserMapper } from '../mappers/merchandiser.mapper';
import { IPaginationOptions } from '../../../../../utils/types/pagination-options';
import { JobTypesEntity } from '../../../../../job-types/infrastructure/persistence/relational/entities/job-types.entity';
import { FilterMerchandiserDto, SortMerchandiserDto } from '../../../../dto/query-merchandiser.dto';
import { MerchandiserJobTypesEntity } from '../../../../../merchandiser-job-types/infrastructure/persistence/relational/entities/merchandiser-job-types.entity';

@Injectable()
export class MerchandiserRelationalRepository
  implements MerchandiserRepository
{
  constructor(
    @InjectRepository(MerchandiserEntity)
    private readonly merchandiserRepository: Repository<MerchandiserEntity>,
    @InjectRepository(JobTypesEntity)
    private readonly jobTypesRepository: Repository<JobTypesEntity>,
    @InjectRepository(MerchandiserJobTypesEntity)
    private readonly merchandiserJobTypesRepository: Repository<MerchandiserJobTypesEntity>,
  ) {}

  async create(data: Merchandiser): Promise<Merchandiser> {
    const persistenceModel = MerchandiserMapper.toPersistence(data);
    
    // Handle contractuals if provided
    if (data.contractuals && data.contractuals.length > 0) {
      const contractualIds = data.contractuals.map(c => c.id);
      const contractuals = await this.jobTypesRepository.findBy({
        id: In(contractualIds)
      });
      persistenceModel.contractuals = contractuals;
    }

    const newEntity = await this.merchandiserRepository.save(
      this.merchandiserRepository.create(persistenceModel),
    );

    // Handle job types if provided
    if (data.jobTypes && data.jobTypes.length > 0) {
      const jobTypeIds = data.jobTypes.map(jt => jt.id);
      const jobTypes = await this.jobTypesRepository.findBy({
        id: In(jobTypeIds)
      });
      await this.merchandiserJobTypesRepository.save(
        jobTypes.map((jobType) => {
          const merchandiserJobType = new MerchandiserJobTypesEntity();
          merchandiserJobType.merchandiser = newEntity;
          merchandiserJobType.jobType = jobType;
          return merchandiserJobType;
        }),
      );
    }
    const created = await this.findById(newEntity.id);
    if (!created) throw new Error('Failed to create merchandiser');
    return created;
  }

  async findAllWithPagination({
    paginationOptions,
    filters,
    sort,
  }: {
    paginationOptions: IPaginationOptions;
    filters?: FilterMerchandiserDto | null;
    sort?: SortMerchandiserDto[] | null;
  }): Promise<{ data: Merchandiser[]; totalCount: number }> {
    const queryBuilder = this.merchandiserRepository
      .createQueryBuilder('merchandiser')
      .leftJoinAndSelect('merchandiser.user', 'user')
      .leftJoinAndSelect('merchandiser.city', 'city')
      .leftJoinAndSelect('city.country', 'country')
      .leftJoinAndSelect('merchandiser.jobTypes', 'jobTypes')
      .leftJoinAndSelect('jobTypes.jobType', 'actualJobType')
      .leftJoinAndSelect('merchandiser.contractuals', 'contractuals')
      .leftJoinAndSelect('merchandiser.status', 'status');

    // Apply filters
    if (filters) {
      this.applyFilters(queryBuilder, filters);
    }

    // Apply sorting
    if (sort && sort.length > 0) {
      sort.forEach((sortOption, index) => {
        const orderBy = this.mapSortField(sortOption.orderBy);
        const order = sortOption.order.toUpperCase() as 'ASC' | 'DESC';
        
        if (index === 0) {
          queryBuilder.orderBy(orderBy, order);
        } else {
          queryBuilder.addOrderBy(orderBy, order);
        }
      });
      queryBuilder.addOrderBy('merchandiser.id', 'DESC');
    } else {
      // Default sorting
      queryBuilder.orderBy('merchandiser.createdAt', 'DESC');
      queryBuilder.addOrderBy('merchandiser.id', 'DESC');
    }

    // Optimize: Get count with DISTINCT to handle joins correctly
    // Clone the query builder and remove all selects/joins except what's needed for count
    const countQuery = queryBuilder
      .clone()
      .select('COUNT(DISTINCT merchandiser.id)', 'count')
      .orderBy(); // Remove ordering for count query
    
    const countResult = await countQuery.getRawOne();
    const totalCount = parseInt(countResult?.count || '0', 10);

    // Apply pagination using distinct merchandiser IDs so one-to-many joins
    // (e.g. job types) do not shrink the result set.
    if (paginationOptions.limit > 0) {
      const offset = (paginationOptions.page - 1) * paginationOptions.limit;
      const idRows = await queryBuilder
        .clone()
        .select('merchandiser.id', 'id')
        .addSelect('merchandiser.createdAt', 'createdAt')
        .distinct(true)
        .offset(offset)
        .limit(paginationOptions.limit)
        .orderBy('merchandiser.createdAt', 'DESC')
        .addOrderBy('merchandiser.id', 'DESC')
        .getRawMany();

      const ids = idRows.map((row) => Number(row.id)).filter((id) => !Number.isNaN(id));
      if (ids.length === 0) {
        return { data: [], totalCount };
      }

      queryBuilder.andWhere('merchandiser.id IN (:...ids)', { ids });
    }

    // Get data - use getMany() instead of getManyAndCount() for better performance
    const entities = await queryBuilder.getMany();
    const data = entities.map((entity) => MerchandiserMapper.toDomain(entity));

    return {
      data,
      totalCount,
    };
  }

  private applyFilters(
    queryBuilder: SelectQueryBuilder<MerchandiserEntity>,
    filters: FilterMerchandiserDto,
  ): void {
    // Search filter - search in user's name, email, or website
    if (filters.search) {
      const searchTerm = `%${filters.search.toLowerCase()}%`;
      queryBuilder.andWhere(
        '(LOWER(user.firstName) LIKE :search OR LOWER(user.lastName) LIKE :search OR CONCAT(LOWER(user.firstName), \' \', LOWER(user.lastName)) LIKE :search OR LOWER(user.email) LIKE :search OR LOWER(merchandiser.website) LIKE :search)',
        { search: searchTerm }
      );
    }

    // Location filter - search by city name or postal code
    if (filters.location) {
      const locationTerm = `%${filters.location.toLowerCase()}%`;
      queryBuilder.andWhere(
        '(LOWER(city.name) LIKE :location OR LOWER(merchandiser.zipCode) LIKE :location)',
        { location: locationTerm }
      );
    }

    // Text-based job types filter (qualifications)
    if (filters.qualifications) {
      const qualificationsTerm = `%${filters.qualifications.toLowerCase()}%`;
      queryBuilder.andWhere('LOWER(actualJobType.name) LIKE :qualifications', {
        qualifications: qualificationsTerm,
      });
    }

    // Text-based specializations filter
    if (filters.specializations) {
      const specializationsTerm = `%${filters.specializations.toLowerCase()}%`;
      queryBuilder
        .leftJoin('merchandiser_specializations', 'ms', 'ms.merchandiser_id = merchandiser.id')
        .leftJoin('specializations', 's', 's.id = ms.specialization_id')
        .andWhere('LOWER(s.name) LIKE :specializations', {
          specializations: specializationsTerm,
        });
    }

    // Text-based languages filter
    if (filters.languages) {
      const languagesTerm = `%${filters.languages.toLowerCase()}%`;
      queryBuilder
        .leftJoin('merchandiser_languages', 'ml', 'ml.merchandiser_id = merchandiser.id')
        .leftJoin('languages', 'l', 'l.id = ml.language_id')
        .andWhere('LOWER(l.name) LIKE :languages', {
          languages: languagesTerm,
        });
    }

    // ID-based filters (keep for backwards compatibility)
    if (filters.jobTypeIds && filters.jobTypeIds.length > 0) {
      queryBuilder.andWhere('jobTypes.id IN (:...jobTypeIds)', {
        jobTypeIds: filters.jobTypeIds,
      });
    }

    // City filter
    if (filters.cityIds && filters.cityIds.length > 0) {
      queryBuilder.andWhere('city.id IN (:...cityIds)', {
        cityIds: filters.cityIds,
      });
    }

    // Country filter
    if (filters.countryIds && filters.countryIds.length > 0) {
      queryBuilder.andWhere('country.id IN (:...countryIds)', {
        countryIds: filters.countryIds,
      });
    }

    // Nationality filter
    if (filters.nationality) {
      const nationalityTerm = `%${filters.nationality.toLowerCase()}%`;
      queryBuilder.andWhere('LOWER(merchandiser.nationality) LIKE :nationality', {
        nationality: nationalityTerm,
      });
    }

    // Gender filter
    if (filters.gender) {
      queryBuilder.andWhere('user.gender = :gender', {
        gender: filters.gender.toLowerCase(),
      });
    }

    // Has website filter
    if (filters.hasWebsite) {
      if (filters.hasWebsite.toLowerCase() === 'true') {
        queryBuilder.andWhere('merchandiser.website IS NOT NULL AND merchandiser.website != \'\'');
      } else if (filters.hasWebsite.toLowerCase() === 'false') {
        queryBuilder.andWhere('(merchandiser.website IS NULL OR merchandiser.website = \'\')');
      }
    }

    // Age range filter
    if (filters.ageRange) {
      const today = new Date();
      let minAge: number, maxAge: number;

      switch (filters.ageRange) {
        case '18-30':
          minAge = 18;
          maxAge = 30;
          break;
        case '31-45':
          minAge = 31;
          maxAge = 45;
          break;
        case '46-60':
          minAge = 46;
          maxAge = 60;
          break;
        case '60+':
          minAge = 60;
          maxAge = 120;
          break;
        default:
          // Try to parse custom range like "25-35"
          const rangeParts = filters.ageRange.split('-');
          if (rangeParts.length === 2) {
            minAge = parseInt(rangeParts[0]);
            maxAge = parseInt(rangeParts[1]);
          } else {
            return; // Invalid range format
          }
      }

      const maxBirthDate = new Date(today.getFullYear() - minAge, today.getMonth(), today.getDate());
      const minBirthDate = new Date(today.getFullYear() - maxAge - 1, today.getMonth(), today.getDate());

      queryBuilder.andWhere(
        'merchandiser.birthday BETWEEN :minBirthDate AND :maxBirthDate',
        { minBirthDate, maxBirthDate }
      );
    }

    // ID-based language filter (keep for backwards compatibility)
    if (filters.languageIds && filters.languageIds.length > 0) {
      queryBuilder
        .leftJoin('merchandiser_languages', 'ml2', 'ml2.merchandiser_id = merchandiser.id')
        .andWhere('ml2.language_id IN (:...languageIds)', {
          languageIds: filters.languageIds,
        });
    }

    // ID-based specialization filter (keep for backwards compatibility)
    if (filters.specializationIds && filters.specializationIds.length > 0) {
      queryBuilder
        .leftJoin('merchandiser_specializations', 'ms2', 'ms2.merchandiser_id = merchandiser.id')
        .andWhere('ms2.specialization_id IN (:...specializationIds)', {
          specializationIds: filters.specializationIds,
        });
    }

    // Status filter - filter by merchandiser status (Neu, Team, etc.)
    if (filters.status) {
      queryBuilder.andWhere('LOWER(status.name) LIKE :status', {
        status: `%${filters.status.toLowerCase()}%`,
      });
    }

    // Client assignment filter - find merchandisers assigned to reports for client companies
    if (filters.clientAssignment) {
      const clientTerm = `%${filters.clientAssignment.toLowerCase()}%`;
      queryBuilder
        .leftJoin('report', 'assignedReport', 'assignedReport.merchandiser_id = merchandiser.id')
        .leftJoin('assignedReport.clientCompany', 'assignedClientCompany')
        .andWhere('LOWER(assignedClientCompany.name) LIKE :clientAssignment', {
          clientAssignment: clientTerm,
        });
    }

    // Custom filter - search across common merchandiser/user fields
    if (filters.customFilter) {
      const customTerm = `%${filters.customFilter.toLowerCase()}%`;
      queryBuilder.andWhere(
        `(LOWER(user.firstName) LIKE :custom OR LOWER(user.lastName) LIKE :custom OR CONCAT(LOWER(user.firstName), ' ', LOWER(user.lastName)) LIKE :custom OR LOWER(user.email) LIKE :custom OR LOWER(user.phone) LIKE :custom OR LOWER(merchandiser.street) LIKE :custom OR LOWER(merchandiser.zipCode) LIKE :custom OR LOWER(city.name) LIKE :custom OR LOWER(merchandiser.nationality) LIKE :custom OR LOWER(actualJobType.name) LIKE :custom OR LOWER(status.name) LIKE :custom)`,
        { custom: customTerm },
      );
    }
  }

  private mapSortField(field: string): string {
    const fieldMappings: { [key: string]: string } = {
      'user.firstName': 'user.firstName',
      'user.lastName': 'user.lastName',
      'user.email': 'user.email',
      'birthday': 'merchandiser.birthday',
      'website': 'merchandiser.website',
      'street': 'merchandiser.street',
      'zipCode': 'merchandiser.zipCode',
      'nationality': 'merchandiser.nationality',
      'createdAt': 'merchandiser.createdAt',
      'updatedAt': 'merchandiser.updatedAt',
    };

    return fieldMappings[field] || `merchandiser.${field}`;
  }

  async findById(
    id: Merchandiser['id'],
  ): Promise<NullableType<Merchandiser>> {
    // Validate ID before querying database
    const numericId = Number(id);
    if (isNaN(numericId) || numericId <= 0) {
      console.error(`Invalid merchandiser ID in findById: ${id} (type: ${typeof id})`);
      return null;
    }

    const entity = await this.merchandiserRepository.findOne({
      where: { id: numericId },
      relations: ['user', 'city', 'city.country', 'jobTypes', 'contractuals'],
    });

    return entity ? MerchandiserMapper.toDomain(entity) : null;
  }

  async findByIds(ids: Merchandiser['id'][]): Promise<Merchandiser[]> {
    const entities = await this.merchandiserRepository.find({
      where: { id: In(ids) },
      relations: ['user', 'city', 'city.country', 'jobTypes', 'contractuals'],
    });

    return entities.map((entity) => MerchandiserMapper.toDomain(entity));
  }

  async findByUserId(userId: number): Promise<NullableType<Merchandiser>> {
    const entity = await this.merchandiserRepository.findOne({
      where: { user: { id: userId } },
      relations: ['user', 'city', 'city.country', 'jobTypes', 'contractuals'],
    });

    return entity ? MerchandiserMapper.toDomain(entity) : null;
  }

  async findByFullName(fullName: string): Promise<NullableType<Merchandiser>> {
    const [firstName, ...rest] = fullName.trim().split(' ');
    const lastName = rest.join(' ');
    const entity = await this.merchandiserRepository
      .createQueryBuilder('merchandiser')
      .leftJoinAndSelect('merchandiser.user', 'user')
      .where('LOWER(user.firstName) = :firstName AND LOWER(user.lastName) = :lastName', {
        firstName: firstName.toLowerCase(),
        lastName: lastName.toLowerCase(),
      })
      .getOne();
    return entity ? MerchandiserMapper.toDomain(entity) : null;
  }

  async update(
    id: Merchandiser['id'],
    payload: Partial<Merchandiser>,
  ): Promise<Merchandiser | null> {
    const entity = await this.merchandiserRepository.findOne({
      where: { id },
      relations: ['jobTypes', 'contractuals'],
    });

    if (!entity) {
      throw new Error('Record not found');
    }

    const domainEntity = MerchandiserMapper.toDomain(entity);
    const updatedData = { ...domainEntity, ...payload };
    const persistenceModel = MerchandiserMapper.toPersistence(updatedData);

    // Handle job types if provided in payload
    if (payload.jobTypes !== undefined) {
      // Remove existing job types
      await this.merchandiserJobTypesRepository.delete({ merchandiser: { id } });
      if (payload.jobTypes && payload.jobTypes.length > 0) {
        const jobTypeIds = payload.jobTypes.map(jt => jt.id);
        const jobTypes = await this.jobTypesRepository.findBy({
          id: In(jobTypeIds)
        });
        await this.merchandiserJobTypesRepository.save(
          jobTypes.map((jobType) => {
            const merchandiserJobType = new MerchandiserJobTypesEntity();
            merchandiserJobType.merchandiser = entity;
            merchandiserJobType.jobType = jobType;
            return merchandiserJobType;
          }),
        );
      }
    }
    // Handle contractuals if provided in payload
    if (payload.contractuals !== undefined) {
      if (payload.contractuals && payload.contractuals.length > 0) {
        const contractualIds = payload.contractuals.map(c => c.id);
        const contractuals = await this.jobTypesRepository.findBy({
          id: In(contractualIds)
        });
        persistenceModel.contractuals = contractuals;
      } else {
        persistenceModel.contractuals = [];
      }
    }

    const updatedEntity = await this.merchandiserRepository.save(persistenceModel);

    return this.findById(updatedEntity.id);
  }

  async remove(id: Merchandiser['id']): Promise<void> {
    await this.merchandiserRepository.delete(id);
  }
}
