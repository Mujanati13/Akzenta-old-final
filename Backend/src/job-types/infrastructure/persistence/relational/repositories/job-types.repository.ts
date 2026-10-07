import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, In } from 'typeorm';
import { JobTypesEntity } from '../entities/job-types.entity';
import { NullableType } from '../../../../../utils/types/nullable.type';
import { JobTypes } from '../../../../domain/job-types';
import { JobTypesRepository } from '../../job-types.repository';
import { JobTypesMapper } from '../mappers/job-types.mapper';
import { IPaginationOptions } from '../../../../../utils/types/pagination-options';

@Injectable()
export class JobTypesRelationalRepository implements JobTypesRepository {
  constructor(
    @InjectRepository(JobTypesEntity)
    private readonly jobTypesRepository: Repository<JobTypesEntity>,
  ) {}

  async create(data: Omit<JobTypes, 'id' | 'createdAt' | 'updatedAt'>): Promise<JobTypes> {
    const persistenceModel = JobTypesMapper.toPersistence({
      ...data,
      id: 0,
      createdAt: new Date(),
      updatedAt: new Date(),
    });
    const newEntity = await this.jobTypesRepository.save(
      this.jobTypesRepository.create(persistenceModel),
    );
    return JobTypesMapper.toDomain(newEntity);
  }

  async findAllWithPagination({
    paginationOptions,
  }: {
    paginationOptions: IPaginationOptions;
  }): Promise<{ data: JobTypes[]; totalCount: number }> {
    const shouldPaginate =
      !!paginationOptions.limit && paginationOptions.limit > 0;

    const [entities, totalCount] = await this.jobTypesRepository.findAndCount({
      skip: shouldPaginate
        ? (paginationOptions.page - 1) * paginationOptions.limit
        : undefined,
      take: shouldPaginate ? paginationOptions.limit : undefined,
    });

    return {
      data: entities.map((entity) => JobTypesMapper.toDomain(entity)),
      totalCount,
    };
  }

  async findById(id: JobTypes['id']): Promise<NullableType<JobTypes>> {
    const entity = await this.jobTypesRepository.findOne({
      where: { id },
    });

    return entity ? JobTypesMapper.toDomain(entity) : null;
  }

  async findByIds(ids: JobTypes['id'][]): Promise<JobTypes[]> {
    const entities = await this.jobTypesRepository.find({
      where: { id: In(ids) },
    });

    return entities.map((entity) => JobTypesMapper.toDomain(entity));
  }

  async update(
    id: JobTypes['id'],
    payload: Partial<JobTypes>,
  ): Promise<JobTypes | null> {
    const entity = await this.jobTypesRepository.findOne({
      where: { id },
    });

    if (!entity) {
      return null;
    }

    const updatedEntity = await this.jobTypesRepository.save(
      this.jobTypesRepository.create(
        JobTypesMapper.toPersistence({
          ...JobTypesMapper.toDomain(entity),
          ...payload,
        }),
      ),
    );

    return JobTypesMapper.toDomain(updatedEntity);
  }

  async remove(id: JobTypes['id']): Promise<void> {
    await this.jobTypesRepository.delete(id);
  }
}