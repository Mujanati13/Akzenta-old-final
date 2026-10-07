import { Injectable } from '@nestjs/common';
import { CreateMerchandiserReferencesDto } from './dto/create-merchandiser-references.dto';
import { UpdateMerchandiserReferencesDto } from './dto/update-merchandiser-references.dto';
import { MerchandiserReferencesRepository } from './infrastructure/persistence/merchandiser-references.repository';
import { IPaginationOptions } from '../utils/types/pagination-options';
import { MerchandiserReferences } from './domain/merchandiser-references';
import { MerchandiserService } from '../merchandiser/merchandiser.service';
import { Merchandiser } from '../merchandiser/domain/merchandiser';

@Injectable()
export class MerchandiserReferencesService {
  constructor(
    private readonly merchandiserReferencesRepository: MerchandiserReferencesRepository,
    private readonly merchandiserService: MerchandiserService,
  ) {}

  async create(createMerchandiserReferencesDto: CreateMerchandiserReferencesDto): Promise<MerchandiserReferences> {
    const merchandiser = await this.merchandiserService.findById(
      createMerchandiserReferencesDto.merchandiser.id,
    );
    if (!merchandiser) {
      throw new Error('Merchandiser not found');
    }

    return this.merchandiserReferencesRepository.create({
      merchandiser,
      company: createMerchandiserReferencesDto.company,
      activity: createMerchandiserReferencesDto.activity,
      branche: createMerchandiserReferencesDto.branche,
      startDate: new Date(createMerchandiserReferencesDto.startDate),
      endDate: createMerchandiserReferencesDto.endDate 
        ? new Date(createMerchandiserReferencesDto.endDate) 
        : null,
    });
  }

  findAllWithPagination({
    paginationOptions,
  }: {
    paginationOptions: IPaginationOptions;
  }) {
    return this.merchandiserReferencesRepository.findAllWithPagination({
      paginationOptions: {
        page: paginationOptions.page,
        limit: paginationOptions.limit,
      },
    });
  }

  findById(id: MerchandiserReferences['id']) {
    return this.merchandiserReferencesRepository.findById(id);
  }

  findByMerchandiserId(merchandiserId: number) {
    return this.merchandiserReferencesRepository.findByMerchandiserId(merchandiserId);
  }

  async update(id: MerchandiserReferences['id'], updateMerchandiserReferencesDto: UpdateMerchandiserReferencesDto) {
    let merchandiser: Merchandiser | undefined = undefined;

    if (updateMerchandiserReferencesDto.merchandiser) {
      const foundMerchandiser = await this.merchandiserService.findById(
        updateMerchandiserReferencesDto.merchandiser.id,
      );
      if (!foundMerchandiser) {
        throw new Error('Merchandiser not found');
      }
      merchandiser = foundMerchandiser;
    }

    return this.merchandiserReferencesRepository.update(id, {
      merchandiser,
      company: updateMerchandiserReferencesDto.company,
      activity: updateMerchandiserReferencesDto.activity,
      branche: updateMerchandiserReferencesDto.branche,
      startDate: updateMerchandiserReferencesDto.startDate 
        ? new Date(updateMerchandiserReferencesDto.startDate) 
        : null,
      endDate: updateMerchandiserReferencesDto.endDate 
        ? new Date(updateMerchandiserReferencesDto.endDate) 
        : null,
    });
  }

  remove(id: MerchandiserReferences['id']) {
    return this.merchandiserReferencesRepository.remove(id);
  }
}