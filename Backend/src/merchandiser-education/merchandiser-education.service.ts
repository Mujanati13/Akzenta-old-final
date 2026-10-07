import { Injectable } from '@nestjs/common';
import { CreateMerchandiserEducationDto } from './dto/create-merchandiser-education.dto';
import { UpdateMerchandiserEducationDto } from './dto/update-merchandiser-education.dto';
import { MerchandiserEducationRepository } from './infrastructure/persistence/merchandiser-education.repository';
import { IPaginationOptions } from '../utils/types/pagination-options';
import { MerchandiserEducation } from './domain/merchandiser-education';
import { MerchandiserService } from '../merchandiser/merchandiser.service';

@Injectable()
export class MerchandiserEducationService {
  constructor(
    private readonly merchandiserEducationRepository: MerchandiserEducationRepository,
    private readonly merchandiserService: MerchandiserService,
  ) {}

  async create(createMerchandiserEducationDto: CreateMerchandiserEducationDto): Promise<MerchandiserEducation> {
    const merchandiser = await this.merchandiserService.findById(
      createMerchandiserEducationDto.merchandiser.id,
    );
    if (!merchandiser) {
      throw new Error('Merchandiser not found');
    }

    return this.merchandiserEducationRepository.create({
      merchandiser,
      company: createMerchandiserEducationDto.company,
      activity: createMerchandiserEducationDto.activity,
      graduationDate: createMerchandiserEducationDto.graduationDate 
        ? new Date(createMerchandiserEducationDto.graduationDate) 
        : null,
    });
  }

  findAllWithPagination({
    paginationOptions,
  }: {
    paginationOptions: IPaginationOptions;
  }) {
    return this.merchandiserEducationRepository.findAllWithPagination({
      paginationOptions: {
        page: paginationOptions.page,
        limit: paginationOptions.limit,
      },
    });
  }

  findById(id: MerchandiserEducation['id']) {
    return this.merchandiserEducationRepository.findById(id);
  }

  findByMerchandiserId(merchandiserId: number) {
    return this.merchandiserEducationRepository.findByMerchandiserId(merchandiserId);
  }

  async update(id: MerchandiserEducation['id'], updateMerchandiserEducationDto: UpdateMerchandiserEducationDto) {
    let merchandiser: typeof updateMerchandiserEducationDto.merchandiser | undefined = undefined;

    if (updateMerchandiserEducationDto.merchandiser) {
      const foundMerchandiser = await this.merchandiserService.findById(
        updateMerchandiserEducationDto.merchandiser.id,
      );
      if (!foundMerchandiser) {
        throw new Error('Merchandiser not found');
      }
      merchandiser = foundMerchandiser;
    }

    return this.merchandiserEducationRepository.update(id, {
      merchandiser,
      company: updateMerchandiserEducationDto.company,
      activity: updateMerchandiserEducationDto.activity,
      graduationDate: updateMerchandiserEducationDto.graduationDate,
    });
  }

  remove(id: MerchandiserEducation['id']) {
    return this.merchandiserEducationRepository.remove(id);
  }
}