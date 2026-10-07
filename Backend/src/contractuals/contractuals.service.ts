import { Injectable } from '@nestjs/common';
import { CreateContractualsDto } from './dto/create-contractuals.dto';
import { UpdateContractualsDto } from './dto/update-contractuals.dto';
import { ContractualsRepository } from './infrastructure/persistence/contractuals.repository';
import { IPaginationOptions } from '../utils/types/pagination-options';
import { Contractuals } from './domain/contractuals';

@Injectable()
export class ContractualsService {
  constructor(
    private readonly contractualsRepository: ContractualsRepository,
  ) {}

  async create(createContractualsDto: CreateContractualsDto): Promise<Contractuals> {
    return this.contractualsRepository.create({
      name: createContractualsDto.name,
    });
  }

  findAllWithPagination({
    paginationOptions,
  }: {
    paginationOptions: IPaginationOptions;
  }) {
    return this.contractualsRepository.findAllWithPagination({
      paginationOptions: {
        page: paginationOptions.page,
        limit: paginationOptions.limit,
      },
    });
  }

  findById(id: Contractuals['id']) {
    return this.contractualsRepository.findById(id);
  }

  findByIds(ids: Contractuals['id'][]) {
    return this.contractualsRepository.findByIds(ids);
  }

  async update(id: Contractuals['id'], updateContractualsDto: UpdateContractualsDto) {
    return this.contractualsRepository.update(id, {
      name: updateContractualsDto.name,
    });
  }

  remove(id: Contractuals['id']) {
    return this.contractualsRepository.remove(id);
  }
}