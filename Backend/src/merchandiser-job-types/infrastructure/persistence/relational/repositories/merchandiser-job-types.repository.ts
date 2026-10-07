import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { NullableType } from '../../../../../utils/types/nullable.type';
import { IPaginationOptions } from '../../../../../utils/types/pagination-options';
import { MerchandiserJobTypesRepository } from '../../merchandiser-job-types.repository';
import { MerchandiserJobTypesEntity } from '../entities/merchandiser-job-types.entity';
import { MerchandiserJobTypes } from '../../../../domain/merchandiser-job-types';
import { MerchandiserJobTypesMapper } from '../mappers/merchandiser-job-types.mapper';

@Injectable()
export class MerchandiserJobTypesRelationalRepository implements MerchandiserJobTypesRepository {
  constructor(
    @InjectRepository(MerchandiserJobTypesEntity)
    private readonly merchandiserJobTypesRepository: Repository<MerchandiserJobTypesEntity>,
  ) {}

  async create(data: Omit<MerchandiserJobTypes, 'id' | 'createdAt' | 'updatedAt'>): Promise<MerchandiserJobTypes> {
    const persistenceModel = MerchandiserJobTypesMapper.toPersistence({
      ...data,
      id: 0,
    });
    const newEntity = await this.merchandiserJobTypesRepository.save(
      this.merchandiserJobTypesRepository.create(persistenceModel),
    );
    return MerchandiserJobTypesMapper.toDomain(newEntity);
  }

  async findAllWithPagination({
    paginationOptions,
  }: {
    paginationOptions: IPaginationOptions;
  }): Promise<{ data: MerchandiserJobTypes[]; totalCount: number }> {
    const [entities, totalCount] = await this.merchandiserJobTypesRepository.findAndCount({
      skip: (paginationOptions.page - 1) * paginationOptions.limit,
      take: paginationOptions.limit,
      relations: ['merchandiser', 'jobType'],
    });

    return {
      data: entities.map((entity) => MerchandiserJobTypesMapper.toDomain(entity)),
      totalCount,
    };
  }

  async findById(id: MerchandiserJobTypes['id']): Promise<NullableType<MerchandiserJobTypes>> {
    const entity = await this.merchandiserJobTypesRepository.findOne({
      where: { id },
      relations: ['merchandiser', 'jobType'],
    });

    return entity ? MerchandiserJobTypesMapper.toDomain(entity) : null;
  }

  async findByMerchandiserId(merchandiserId: number): Promise<MerchandiserJobTypes[]> {
    const entities = await this.merchandiserJobTypesRepository.find({
      where: { merchandiser: { id: merchandiserId } },
      relations: ['merchandiser', 'jobType'],
    });

    return entities.map((entity) => MerchandiserJobTypesMapper.toDomain(entity));
  }

  async update(
    id: MerchandiserJobTypes['id'],
    payload: Partial<MerchandiserJobTypes>,
  ): Promise<MerchandiserJobTypes | null> {
    const entity = await this.merchandiserJobTypesRepository.findOne({
      where: { id },
      relations: ['merchandiser', 'jobType'],
    });

    if (!entity) {
      return null;
    }

    const updatedEntity = await this.merchandiserJobTypesRepository.save(
      this.merchandiserJobTypesRepository.create(
        MerchandiserJobTypesMapper.toPersistence({
          ...MerchandiserJobTypesMapper.toDomain(entity),
          ...payload,
        }),
      ),
    );

    return MerchandiserJobTypesMapper.toDomain(updatedEntity);
  }

  async remove(id: MerchandiserJobTypes['id']): Promise<void> {
    await this.merchandiserJobTypesRepository.delete(id);
  }
}