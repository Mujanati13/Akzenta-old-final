import { Injectable } from '@nestjs/common';
import { CreateLanguagesDto } from './dto/create-languages.dto';
import { UpdateLanguagesDto } from './dto/update-languages.dto';
import { LanguagesRepository } from './infrastructure/persistence/languages.repository';
import { IPaginationOptions } from '../utils/types/pagination-options';
import { Languages } from './domain/languages';

@Injectable()
export class LanguagesService {
  constructor(
    private readonly languagesRepository: LanguagesRepository,
  ) {}

  async create(createLanguagesDto: CreateLanguagesDto): Promise<Languages> {
    return this.languagesRepository.create({
      name: createLanguagesDto.name,
    });
  }

  findAllWithPagination({
    paginationOptions,
  }: {
    paginationOptions: IPaginationOptions;
  }) {
    return this.languagesRepository.findAllWithPagination({
      paginationOptions: {
        page: paginationOptions.page,
        limit: paginationOptions.limit,
      },
    });
  }

  findById(id: Languages['id']) {
    return this.languagesRepository.findById(id);
  }

  findByIds(ids: Languages['id'][]) {
    return this.languagesRepository.findByIds(ids);
  }

  async update(id: Languages['id'], updateLanguagesDto: UpdateLanguagesDto) {
    return this.languagesRepository.update(id, {
      name: updateLanguagesDto.name,
    });
  }

  remove(id: Languages['id']) {
    return this.languagesRepository.remove(id);
  }
}