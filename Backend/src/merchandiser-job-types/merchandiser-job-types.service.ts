import { Injectable, Inject, forwardRef } from '@nestjs/common';
import { CreateMerchandiserJobTypesDto } from './dto/create-merchandiser-job-types.dto';
import { IPaginationOptions } from '../utils/types/pagination-options';
import { MerchandiserJobTypes } from './domain/merchandiser-job-types';
import { MerchandiserService } from '../merchandiser/merchandiser.service';
import { MerchandiserJobTypesRepository } from './infrastructure/persistence/merchandiser-job-types.repository';
import { UpdateMerchandiserJobTypesDto } from './dto/update-merchandiser-job-types.dto';
import { Merchandiser } from '../merchandiser/domain/merchandiser';
import { JobTypesService } from '../job-types/job-types.service';
import { JobTypes } from '../job-types/domain/job-types';

@Injectable()
export class MerchandiserJobTypesService {
  constructor(
    private readonly merchandiserJobTypesRepository: MerchandiserJobTypesRepository,
    @Inject(forwardRef(() => MerchandiserService))
    private readonly merchandiserService: MerchandiserService,
    private readonly jobTypesService: JobTypesService,
  ) {}

  async create(createMerchandiserJobTypesDto: CreateMerchandiserJobTypesDto): Promise<MerchandiserJobTypes> {
    const merchandiser = await this.merchandiserService.findById(
      createMerchandiserJobTypesDto.merchandiser.id,
    );
    if (!merchandiser) {
      throw new Error('Merchandiser not found');
    }

    const jobType = await this.jobTypesService.findById(
      createMerchandiserJobTypesDto.jobType.id,
    );
    if (!jobType) {
      throw new Error('Job Type not found');
    }

    return this.merchandiserJobTypesRepository.create({
      merchandiser,
      jobType,
      comment: createMerchandiserJobTypesDto.comment,
    });
  }

  findAllWithPagination({
    paginationOptions,
  }: {
    paginationOptions: IPaginationOptions;
  }) {
    return this.merchandiserJobTypesRepository.findAllWithPagination({
      paginationOptions: {
        page: paginationOptions.page,
        limit: paginationOptions.limit,
      },
    });
  }

  findById(id: MerchandiserJobTypes['id']) {
    return this.merchandiserJobTypesRepository.findById(id);
  }

  findByMerchandiserId(merchandiserId: number) {
    return this.merchandiserJobTypesRepository.findByMerchandiserId(merchandiserId);
  }

  async update(id: MerchandiserJobTypes['id'], updateMerchandiserJobTypesDto: UpdateMerchandiserJobTypesDto) {
    let merchandiser: Merchandiser | undefined = undefined;
    let jobType: JobTypes | undefined = undefined;

    if (updateMerchandiserJobTypesDto.merchandiser) {
      const foundMerchandiser = await this.merchandiserService.findById(
        updateMerchandiserJobTypesDto.merchandiser.id,
      );
      if (!foundMerchandiser) {
        throw new Error('Merchandiser not found');
      }
      merchandiser = foundMerchandiser;
    }

    if (updateMerchandiserJobTypesDto.jobType) {
      const foundJobType = await this.jobTypesService.findById(
        updateMerchandiserJobTypesDto.jobType.id,
      );
      if (!foundJobType) {
        throw new Error('Job Type not found');
      }
      jobType = foundJobType;
    }

    return this.merchandiserJobTypesRepository.update(id, {
      merchandiser,
      jobType,
      comment: updateMerchandiserJobTypesDto.comment,
    });
  }

  remove(id: MerchandiserJobTypes['id']) {
    return this.merchandiserJobTypesRepository.remove(id);
  }
}