import { Injectable } from '@nestjs/common';
import { CreateStatusDto } from './dto/create-status.dto';
import { UpdateStatusDto } from './dto/update-status.dto';
import { IPaginationOptions } from '../utils/types/pagination-options';
import { StatusRepository } from './infrastructure/persistence/status.repository';
import { Status } from './domain/status';

@Injectable()
export class MerchandiserStatusService {
  constructor(private readonly statusRepository: StatusRepository) {}

  async create(createStatusDto: CreateStatusDto): Promise<Status> {
    return this.statusRepository.create({
      name: createStatusDto.name,
    });
  }

  findAllWithPagination({
    paginationOptions,
  }: {
    paginationOptions: IPaginationOptions;
  }) {
    return this.statusRepository.findAllWithPagination({
      paginationOptions: {
        page: paginationOptions.page,
        limit: paginationOptions.limit,
      },
    });
  }

  findById(id: Status['id']) {
    return this.statusRepository.findById(id);
  }

  findByIds(ids: Status['id'][]) {
    return this.statusRepository.findByIds(ids);
  }

  async update(id: Status['id'], updateStatusDto: UpdateStatusDto) {
    return this.statusRepository.update(id, {
      name: updateStatusDto.name,
    });
  }

  remove(id: Status['id']) {
    return this.statusRepository.remove(id);
  }
}
