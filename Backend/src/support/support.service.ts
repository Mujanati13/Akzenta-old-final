import { Injectable } from '@nestjs/common';
import { CreateSupportDto } from './dto/create-support.dto';
import { UpdateSupportDto } from './dto/update-support.dto';
import { SupportRepository } from './infrastructure/persistence/support.repository';
import { IPaginationOptions } from '../utils/types/pagination-options';
import { Support } from './domain/support';

@Injectable()
export class SupportService {
  constructor(private readonly supportRepository: SupportRepository) {}

  create(createSupportDto: CreateSupportDto) {
    return this.supportRepository.create(createSupportDto);
  }

  findAllWithPagination({
    paginationOptions,
  }: {
    paginationOptions: IPaginationOptions;
  }) {
    return this.supportRepository.findAllWithPagination({
      paginationOptions: {
        page: paginationOptions.page,
        limit: paginationOptions.limit,
      },
    });
  }

  findById(id: Support['id']) {
    return this.supportRepository.findById(id);
  }

  findByEmail(email: string) {
    return this.supportRepository.findByEmail(email);
  }

  update(id: Support['id'], updateSupportDto: UpdateSupportDto) {
    return this.supportRepository.update(id, updateSupportDto);
  }

  remove(id: Support['id']) {
    return this.supportRepository.remove(id);
  }
}

