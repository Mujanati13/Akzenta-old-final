import { Injectable } from '@nestjs/common';
import { CreateSpecializationsDto } from './dto/create-specializations.dto';
import { UpdateSpecializationsDto } from './dto/update-specializations.dto';
import { SpecializationsRepository } from './infrastructure/persistence/specializations.repository';
import { IPaginationOptions } from '../utils/types/pagination-options';
import { Specializations } from './domain/specializations';
import { JobTypesService } from '../job-types/job-types.service';
import { JobTypes } from '../job-types/domain/job-types';

@Injectable()
export class SpecializationsService {
  constructor(
    private readonly specializationsRepository: SpecializationsRepository,
    private readonly jobTypesService: JobTypesService,
  ) {}

  async create(createSpecializationsDto: CreateSpecializationsDto): Promise<Specializations> {
    const jobType = await this.jobTypesService.findById(createSpecializationsDto.jobType.id);
    if (!jobType) {
      throw new Error('Job type not found');
    }

    return this.specializationsRepository.create({
      jobType,
      name: createSpecializationsDto.name,
    });
  }

  findAllWithPagination({
    paginationOptions,
  }: {
    paginationOptions: IPaginationOptions;
  }) {
    return this.specializationsRepository.findAllWithPagination({
      paginationOptions: {
        page: paginationOptions.page,
        limit: paginationOptions.limit,
      },
    });
  }

  findById(id: Specializations['id']) {
    return this.specializationsRepository.findById(id);
  }

  findByIds(ids: Specializations['id'][]) {
    return this.specializationsRepository.findByIds(ids);
  }

  findByJobTypeId(jobTypeId: number) {
    return this.specializationsRepository.findByJobTypeId(jobTypeId);
  }

  async update(id: Specializations['id'], updateSpecializationsDto: UpdateSpecializationsDto) {
    let jobType: JobTypes | undefined = undefined;

    if (updateSpecializationsDto.jobType) {
      const foundJobType = await this.jobTypesService.findById(updateSpecializationsDto.jobType.id);
      if (!foundJobType) {
        throw new Error('Job type not found');
      }
      jobType = foundJobType;
    }

    return this.specializationsRepository.update(id, {
      jobType,
      name: updateSpecializationsDto.name,
    });
  }

  remove(id: Specializations['id']) {
    return this.specializationsRepository.remove(id);
  }
}