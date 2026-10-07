import { Injectable } from '@nestjs/common';
import { CreateJobTypesDto } from './dto/create-job-types.dto';
import { UpdateJobTypesDto } from './dto/update-job-types.dto';
import { JobTypesRepository } from './infrastructure/persistence/job-types.repository';
import { IPaginationOptions } from '../utils/types/pagination-options';
import { JobTypes } from './domain/job-types';

@Injectable()
export class JobTypesService {
  constructor(
    private readonly jobTypesRepository: JobTypesRepository,
  ) {}

  async create(createJobTypesDto: CreateJobTypesDto): Promise<JobTypes> {
    return this.jobTypesRepository.create({
      name: createJobTypesDto.name,
    });
  }

  findAllWithPagination({
    paginationOptions,
  }: {
    paginationOptions: IPaginationOptions;
  }) {
    return this.jobTypesRepository.findAllWithPagination({
      paginationOptions: {
        page: paginationOptions.page,
        limit: paginationOptions.limit,
      },
    });
  }

  findById(id: JobTypes['id']) {
    return this.jobTypesRepository.findById(id);
  }

  findByIds(ids: JobTypes['id'][]) {
    return this.jobTypesRepository.findByIds(ids);
  }

  async update(id: JobTypes['id'], updateJobTypesDto: UpdateJobTypesDto) {
    return this.jobTypesRepository.update(id, {
      name: updateJobTypesDto.name,
    });
  }

  remove(id: JobTypes['id']) {
    return this.jobTypesRepository.remove(id);
  }
}