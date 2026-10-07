import { Injectable } from '@nestjs/common';
import { CreateMerchandiserSpecializationsDto } from './dto/create-merchandiser-specializations.dto';
import { UpdateMerchandiserSpecializationsDto } from './dto/update-merchandiser-specializations.dto';
import { MerchandiserSpecializationsRepository } from './infrastructure/persistence/merchandiser-specializations.repository';
import { IPaginationOptions } from '../utils/types/pagination-options';
import { MerchandiserSpecializations } from './domain/merchandiser-specializations';
import { MerchandiserService } from '../merchandiser/merchandiser.service';
import { SpecializationsService } from '../specializations/specializations.service';
import { Merchandiser } from '../merchandiser/domain/merchandiser';
import { Specializations } from '../specializations/domain/specializations';

@Injectable()
export class MerchandiserSpecializationsService {
  constructor(
    private readonly merchandiserSpecializationsRepository: MerchandiserSpecializationsRepository,
    private readonly merchandiserService: MerchandiserService,
    private readonly specializationsService: SpecializationsService,
  ) {}

  async create(createMerchandiserSpecializationsDto: CreateMerchandiserSpecializationsDto): Promise<MerchandiserSpecializations> {
    const merchandiser = await this.merchandiserService.findById(
      createMerchandiserSpecializationsDto.merchandiser.id,
    );
    if (!merchandiser) {
      throw new Error('Merchandiser not found');
    }

    const specialization = await this.specializationsService.findById(
      createMerchandiserSpecializationsDto.specialization.id,
    );
    if (!specialization) {
      throw new Error('Specialization not found');
    }

    return this.merchandiserSpecializationsRepository.create({
      merchandiser,
      specialization,
    });
  }

  findAllWithPagination({
    paginationOptions,
  }: {
    paginationOptions: IPaginationOptions;
  }) {
    return this.merchandiserSpecializationsRepository.findAllWithPagination({
      paginationOptions: {
        page: paginationOptions.page,
        limit: paginationOptions.limit,
      },
    });
  }

  findById(id: MerchandiserSpecializations['id']) {
    return this.merchandiserSpecializationsRepository.findById(id);
  }

  findByMerchandiserId(merchandiserId: number) {
    return this.merchandiserSpecializationsRepository.findByMerchandiserId(merchandiserId);
  }

  async update(id: MerchandiserSpecializations['id'], updateMerchandiserSpecializationsDto: UpdateMerchandiserSpecializationsDto) {
    let merchandiser: Merchandiser | undefined = undefined;
    let specialization: Specializations | undefined = undefined;

    if (updateMerchandiserSpecializationsDto.merchandiser) {
      const foundMerchandiser = await this.merchandiserService.findById(
        updateMerchandiserSpecializationsDto.merchandiser.id,
      );
      if (!foundMerchandiser) {
        throw new Error('Merchandiser not found');
      }
      merchandiser = foundMerchandiser;
    }

    if (updateMerchandiserSpecializationsDto.specialization) {
      const foundSpecialization = await this.specializationsService.findById(
        updateMerchandiserSpecializationsDto.specialization.id,
      );
      if (!foundSpecialization) {
        throw new Error('Specialization not found');
      }
      specialization = foundSpecialization;
    }

    return this.merchandiserSpecializationsRepository.update(id, {
      merchandiser,
      specialization,
    });
  }

  remove(id: MerchandiserSpecializations['id']) {
    return this.merchandiserSpecializationsRepository.remove(id);
  }
}