import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { MerchandiserEducationEntity } from '../entities/merchandiser-education.entity';
import { NullableType } from '../../../../../utils/types/nullable.type';
import { MerchandiserEducation } from '../../../../domain/merchandiser-education';
import { MerchandiserEducationRepository } from '../../merchandiser-education.repository';
import { MerchandiserEducationMapper } from '../mappers/merchandiser-education.mapper';
import { IPaginationOptions } from '../../../../../utils/types/pagination-options';

@Injectable()
export class MerchandiserEducationRelationalRepository implements MerchandiserEducationRepository {
  constructor(
    @InjectRepository(MerchandiserEducationEntity)
    private readonly merchandiserEducationRepository: Repository<MerchandiserEducationEntity>,
  ) {}

  async create(data: Omit<MerchandiserEducation, 'id' | 'createdAt' | 'updatedAt'>): Promise<MerchandiserEducation> {
    const persistenceModel = MerchandiserEducationMapper.toPersistence({
      ...data,
      id: 0,
      createdAt: new Date(),
      updatedAt: new Date(),
    });
    const newEntity = await this.merchandiserEducationRepository.save(
      this.merchandiserEducationRepository.create(persistenceModel),
    );
    return MerchandiserEducationMapper.toDomain(newEntity);
  }

  async findAllWithPagination({
    paginationOptions,
  }: {
    paginationOptions: IPaginationOptions;
  }): Promise<{ data: MerchandiserEducation[]; totalCount: number }> {
    const [entities, totalCount] = await this.merchandiserEducationRepository.findAndCount({
      skip: (paginationOptions.page - 1) * paginationOptions.limit,
      take: paginationOptions.limit,
      relations: ['merchandiser'],
    });

    return {
      data: entities.map((entity) => MerchandiserEducationMapper.toDomain(entity)),
      totalCount,
    };
  }

  async findById(id: MerchandiserEducation['id']): Promise<NullableType<MerchandiserEducation>> {
    const entity = await this.merchandiserEducationRepository.findOne({
      where: { id },
      relations: ['merchandiser'],
    });

    return entity ? MerchandiserEducationMapper.toDomain(entity) : null;
  }

  async findByMerchandiserId(merchandiserId: number): Promise<MerchandiserEducation[]> {
    const entities = await this.merchandiserEducationRepository.find({
      where: { merchandiser: { id: merchandiserId } },
    });

    return entities.map((entity) => MerchandiserEducationMapper.toDomain(entity));
  }

  async update(
    id: MerchandiserEducation['id'],
    payload: Partial<MerchandiserEducation>,
  ): Promise<MerchandiserEducation | null> {
    const entity = await this.merchandiserEducationRepository.findOne({
      where: { id },
      relations: ['merchandiser'],
    });

    if (!entity) {
      return null;
    }

    const updatedEntity = await this.merchandiserEducationRepository.save(
      this.merchandiserEducationRepository.create(
        MerchandiserEducationMapper.toPersistence({
          ...MerchandiserEducationMapper.toDomain(entity),
          ...payload,
        }),
      ),
    );

    return MerchandiserEducationMapper.toDomain(updatedEntity);
  }

  async remove(id: MerchandiserEducation['id']): Promise<void> {
    await this.merchandiserEducationRepository.delete(id);
  }
}