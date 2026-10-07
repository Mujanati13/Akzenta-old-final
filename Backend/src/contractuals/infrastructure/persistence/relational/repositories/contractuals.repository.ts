import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, In } from 'typeorm';
import { ContractualsEntity } from '../entities/contractuals.entity';
import { NullableType } from '../../../../../utils/types/nullable.type';
import { Contractuals } from '../../../../domain/contractuals';
import { ContractualsRepository } from '../../contractuals.repository';
import { ContractualsMapper } from '../mappers/contractuals.mapper';
import { IPaginationOptions } from '../../../../../utils/types/pagination-options';

@Injectable()
export class ContractualsRelationalRepository implements ContractualsRepository {
  constructor(
    @InjectRepository(ContractualsEntity)
    private readonly contractualsRepository: Repository<ContractualsEntity>,
  ) {}

  async create(data: Omit<Contractuals, 'id' | 'createdAt' | 'updatedAt'>): Promise<Contractuals> {
    const persistenceModel = ContractualsMapper.toPersistence({
      ...data,
      id: 0,
      createdAt: new Date(),
      updatedAt: new Date(),
    });
    const newEntity = await this.contractualsRepository.save(
      this.contractualsRepository.create(persistenceModel),
    );
    return ContractualsMapper.toDomain(newEntity);
  }

  async findAllWithPagination({
    paginationOptions,
  }: {
    paginationOptions: IPaginationOptions;
  }): Promise<{ data: Contractuals[]; totalCount: number }> {
    const [entities, totalCount] = await this.contractualsRepository.findAndCount({
      skip: (paginationOptions.page - 1) * paginationOptions.limit,
      take: paginationOptions.limit,
    });

    return {
      data: entities.map((entity) => ContractualsMapper.toDomain(entity)),
      totalCount,
    };
  }

  async findById(id: Contractuals['id']): Promise<NullableType<Contractuals>> {
    const entity = await this.contractualsRepository.findOne({
      where: { id },
    });

    return entity ? ContractualsMapper.toDomain(entity) : null;
  }

  async findByIds(ids: Contractuals['id'][]): Promise<Contractuals[]> {
    const entities = await this.contractualsRepository.find({
      where: { id: In(ids) },
    });

    return entities.map((entity) => ContractualsMapper.toDomain(entity));
  }

  async update(
    id: Contractuals['id'],
    payload: Partial<Contractuals>,
  ): Promise<Contractuals | null> {
    const entity = await this.contractualsRepository.findOne({
      where: { id },
    });

    if (!entity) {
      return null;
    }

    const updatedEntity = await this.contractualsRepository.save(
      this.contractualsRepository.create(
        ContractualsMapper.toPersistence({
          ...ContractualsMapper.toDomain(entity),
          ...payload,
        }),
      ),
    );

    return ContractualsMapper.toDomain(updatedEntity);
  }

  async remove(id: Contractuals['id']): Promise<void> {
    await this.contractualsRepository.delete(id);
  }
}