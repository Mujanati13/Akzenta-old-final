import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { MerchandiserSpecializationsEntity } from '../entities/merchandiser-specializations.entity';
import { NullableType } from '../../../../../utils/types/nullable.type';
import { MerchandiserSpecializations } from '../../../../domain/merchandiser-specializations';
import { MerchandiserSpecializationsRepository } from '../../merchandiser-specializations.repository';
import { MerchandiserSpecializationsMapper } from '../mappers/merchandiser-specializations.mapper';
import { IPaginationOptions } from '../../../../../utils/types/pagination-options';

@Injectable()
export class MerchandiserSpecializationsRelationalRepository implements MerchandiserSpecializationsRepository {
  constructor(
    @InjectRepository(MerchandiserSpecializationsEntity)
    private readonly merchandiserSpecializationsRepository: Repository<MerchandiserSpecializationsEntity>,
  ) {}

  async create(data: Omit<MerchandiserSpecializations, 'id' | 'createdAt' | 'updatedAt'>): Promise<MerchandiserSpecializations> {
    const persistenceModel = MerchandiserSpecializationsMapper.toPersistence({
      ...data,
      id: 0,
      createdAt: new Date(),
      updatedAt: new Date(),
    });
    const newEntity = await this.merchandiserSpecializationsRepository.save(
      this.merchandiserSpecializationsRepository.create(persistenceModel),
    );
    return MerchandiserSpecializationsMapper.toDomain(newEntity);
  }

  async findAllWithPagination({
    paginationOptions,
  }: {
    paginationOptions: IPaginationOptions;
  }): Promise<{ data: MerchandiserSpecializations[]; totalCount: number }> {
    const [entities, totalCount] = await this.merchandiserSpecializationsRepository.findAndCount({
      skip: (paginationOptions.page - 1) * paginationOptions.limit,
      take: paginationOptions.limit,
      relations: ['merchandiser', 'specialization'],
    });

    return {
      data: entities.map((entity) => MerchandiserSpecializationsMapper.toDomain(entity)),
      totalCount,
    };
  }

  async findById(id: MerchandiserSpecializations['id']): Promise<NullableType<MerchandiserSpecializations>> {
    const entity = await this.merchandiserSpecializationsRepository.findOne({
      where: { id },
      relations: ['merchandiser', 'specialization'],
    });

    return entity ? MerchandiserSpecializationsMapper.toDomain(entity) : null;
  }

  async findByMerchandiserId(merchandiserId: number): Promise<MerchandiserSpecializations[]> {
    const entities = await this.merchandiserSpecializationsRepository.find({
      where: { merchandiser: { id: merchandiserId } },
      relations: ['merchandiser', 'specialization', 'specialization.jobType'],
    });

    return entities.map((entity) => MerchandiserSpecializationsMapper.toDomain(entity));
  }

  async update(
    id: MerchandiserSpecializations['id'],
    payload: Partial<MerchandiserSpecializations>,
  ): Promise<MerchandiserSpecializations | null> {
    const entity = await this.merchandiserSpecializationsRepository.findOne({
      where: { id },
      relations: ['merchandiser', 'specialization'],
    });

    if (!entity) {
      return null;
    }

    const updatedEntity = await this.merchandiserSpecializationsRepository.save(
      this.merchandiserSpecializationsRepository.create(
        MerchandiserSpecializationsMapper.toPersistence({
          ...MerchandiserSpecializationsMapper.toDomain(entity),
          ...payload,
        }),
      ),
    );

    return MerchandiserSpecializationsMapper.toDomain(updatedEntity);
  }

  async remove(id: MerchandiserSpecializations['id']): Promise<void> {
    await this.merchandiserSpecializationsRepository.delete(id);
  }
}