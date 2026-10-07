import { Injectable } from '@nestjs/common';
import { CreateMerchandiserLanguagesDto } from './dto/create-merchandiser-languages.dto';
import { IPaginationOptions } from '../utils/types/pagination-options';
import { MerchandiserLanguages } from './domain/merchandiser-languages';
import { MerchandiserService } from '../merchandiser/merchandiser.service';
import { LanguagesService } from '../languages/languages.service';
import { MerchandiserLanguagesRepository } from './infrastructure/persistence/merchandiser-languages.repository';
import { UpdateMerchandiserLanguagesDto } from './dto/update-merchandiser-languages.dto';
import { Merchandiser } from '../merchandiser/domain/merchandiser';
import { Languages } from '../languages/domain/languages';

@Injectable()
export class MerchandiserLanguagesService {
  constructor(
    private readonly merchandiserLanguagesRepository: MerchandiserLanguagesRepository,
    private readonly merchandiserService: MerchandiserService,
    private readonly languagesService: LanguagesService,
  ) {}

  async create(createMerchandiserLanguagesDto: CreateMerchandiserLanguagesDto): Promise<MerchandiserLanguages> {
    const merchandiser = await this.merchandiserService.findById(
      createMerchandiserLanguagesDto.merchandiser.id,
    );
    if (!merchandiser) {
      throw new Error('Merchandiser not found');
    }

    const language = await this.languagesService.findById(
      createMerchandiserLanguagesDto.language.id,
    );
    if (!language) {
      throw new Error('Language not found');
    }

    return this.merchandiserLanguagesRepository.create({
      merchandiser,
      language,
      level: createMerchandiserLanguagesDto.level,
    });
  }

  findAllWithPagination({
    paginationOptions,
  }: {
    paginationOptions: IPaginationOptions;
  }) {
    return this.merchandiserLanguagesRepository.findAllWithPagination({
      paginationOptions: {
        page: paginationOptions.page,
        limit: paginationOptions.limit,
      },
    });
  }

  findById(id: MerchandiserLanguages['id']) {
    return this.merchandiserLanguagesRepository.findById(id);
  }

  findByMerchandiserId(merchandiserId: number) {
    return this.merchandiserLanguagesRepository.findByMerchandiserId(merchandiserId);
  }

  async update(id: MerchandiserLanguages['id'], updateMerchandiserLanguagesDto: UpdateMerchandiserLanguagesDto) {
    let merchandiser: Merchandiser | undefined = undefined;
    let language: Languages | undefined = undefined;

    if (updateMerchandiserLanguagesDto.merchandiser) {
      const foundMerchandiser = await this.merchandiserService.findById(
        updateMerchandiserLanguagesDto.merchandiser.id,
      );
      if (!foundMerchandiser) {
        throw new Error('Merchandiser not found');
      }
      merchandiser = foundMerchandiser;
    }

    if (updateMerchandiserLanguagesDto.language) {
      const foundLanguage = await this.languagesService.findById(
        updateMerchandiserLanguagesDto.language.id,
      );
      if (!foundLanguage) {
        throw new Error('Language not found');
      }
      language = foundLanguage;
    }

    return this.merchandiserLanguagesRepository.update(id, {
      merchandiser,
      language,
      level: updateMerchandiserLanguagesDto.level,
    });
  }

  remove(id: MerchandiserLanguages['id']) {
    return this.merchandiserLanguagesRepository.remove(id);
  }
}