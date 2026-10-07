import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, In } from 'typeorm';
import { SpecializationsEntity } from '../entities/specializations.entity';
import { NullableType } from '../../../../../utils/types/nullable.type';
import { Specializations } from '../../../../domain/specializations';
import { SpecializationsRepository } from '../../specializations.repository';
import { SpecializationsMapper } from '../mappers/specializations.mapper';
import { IPaginationOptions } from '../../../../../utils/types/pagination-options';

@Injectable()
export class SpecializationsRelationalRepository implements SpecializationsRepository {
  constructor(
    @InjectRepository(SpecializationsEntity)
    private readonly specializationsRepository: Repository<SpecializationsEntity>,
  ) {}

  async create(data: Omit<Specializations, 'id' | 'createdAt' | 'updatedAt'>): Promise<Specializations> {
    const persistenceModel = SpecializationsMapper.toPersistence({
      ...data,
      id: 0,
      createdAt: new Date(),
      updatedAt: new Date(),
    });
    const newEntity = await this.specializationsRepository.save(
      this.specializationsRepository.create(persistenceModel),
    );
    return SpecializationsMapper.toDomain(newEntity);
  }

  async findAllWithPagination({
    paginationOptions,
  }: {
    paginationOptions: IPaginationOptions;
  }): Promise<{ data: Specializations[]; totalCount: number }> {
    const [entities, totalCount] = await this.specializationsRepository.findAndCount({
      skip: (paginationOptions.page - 1) * paginationOptions.limit,
      take: paginationOptions.limit,
      relations: ['jobType'],
    });

    return {
      data: entities.map((entity) => SpecializationsMapper.toDomain(entity)),
      totalCount,
    };
  }

  async findById(id: Specializations['id']): Promise<NullableType<Specializations>> {
    const entity = await this.specializationsRepository.findOne({
      where: { id },
      relations: ['jobType'],
    });

    return entity ? SpecializationsMapper.toDomain(entity) : null;
  }

  async findByIds(ids: Specializations['id'][]): Promise<Specializations[]> {
    const entities = await this.specializationsRepository.find({
      where: { id: In(ids) },
      relations: ['jobType'],
    });

    return entities.map((entity) => SpecializationsMapper.toDomain(entity));
  }

  async findByJobTypeId(jobTypeId: number): Promise<Specializations[]> {
    const entities = await this.specializationsRepository.find({
      where: { jobType: { id: jobTypeId } },
      relations: ['jobType'],
    });

    return entities.map((entity) => SpecializationsMapper.toDomain(entity));
  }

  async update(
    id: Specializations['id'],
    payload: Partial<Specializations>,
  ): Promise<Specializations | null> {
    const entity = await this.specializationsRepository.findOne({
      where: { id },
      relations: ['jobType'],
    });

    if (!entity) {
      return null;
    }

    const updatedEntity = await this.specializationsRepository.save(
      this.specializationsRepository.create(
        SpecializationsMapper.toPersistence({
          ...SpecializationsMapper.toDomain(entity),
          ...payload,
        }),
      ),
    );

    return SpecializationsMapper.toDomain(updatedEntity);
  }

  async remove(id: Specializations['id']): Promise<void> {
    await this.specializationsRepository.delete(id);
  }
}