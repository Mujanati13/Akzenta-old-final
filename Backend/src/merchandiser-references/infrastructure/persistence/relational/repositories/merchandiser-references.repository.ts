import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { MerchandiserReferencesEntity } from '../entities/merchandiser-references.entity';
import { NullableType } from '../../../../../utils/types/nullable.type';
import { MerchandiserReferences } from '../../../../domain/merchandiser-references';
import { MerchandiserReferencesRepository } from '../../merchandiser-references.repository';
import { MerchandiserReferencesMapper } from '../mappers/merchandiser-references.mapper';
import { IPaginationOptions } from '../../../../../utils/types/pagination-options';

@Injectable()
export class MerchandiserReferencesRelationalRepository implements MerchandiserReferencesRepository {
  constructor(
    @InjectRepository(MerchandiserReferencesEntity)
    private readonly merchandiserReferencesRepository: Repository<MerchandiserReferencesEntity>,
  ) {}

  async create(data: Omit<MerchandiserReferences, 'id' | 'createdAt' | 'updatedAt'>): Promise<MerchandiserReferences> {
    const persistenceModel = MerchandiserReferencesMapper.toPersistence({
      ...data,
      id: 0,
      createdAt: new Date(),
      updatedAt: new Date(),
    });
    const newEntity = await this.merchandiserReferencesRepository.save(
      this.merchandiserReferencesRepository.create(persistenceModel),
    );
    return MerchandiserReferencesMapper.toDomain(newEntity);
  }

  async findAllWithPagination({
    paginationOptions,
  }: {
    paginationOptions: IPaginationOptions;
  }): Promise<{ data: MerchandiserReferences[]; totalCount: number }> {
    const [entities, totalCount] = await this.merchandiserReferencesRepository.findAndCount({
      skip: (paginationOptions.page - 1) * paginationOptions.limit,
      take: paginationOptions.limit,
      relations: ['merchandiser'],
    });

    return {
      data: entities.map((entity) => MerchandiserReferencesMapper.toDomain(entity)),
      totalCount,
    };
  }

  async findById(id: MerchandiserReferences['id']): Promise<NullableType<MerchandiserReferences>> {
    const entity = await this.merchandiserReferencesRepository.findOne({
      where: { id },
      relations: ['merchandiser'],
    });

    return entity ? MerchandiserReferencesMapper.toDomain(entity) : null;
  }

  async findByMerchandiserId(merchandiserId: number): Promise<MerchandiserReferences[]> {
    const entities = await this.merchandiserReferencesRepository.find({
      where: { merchandiser: { id: merchandiserId } },
      relations: ['merchandiser'],
    });

    return entities.map((entity) => MerchandiserReferencesMapper.toDomain(entity));
  }

  async update(
    id: MerchandiserReferences['id'],
    payload: Partial<MerchandiserReferences>,
  ): Promise<MerchandiserReferences | null> {
    const entity = await this.merchandiserReferencesRepository.findOne({
      where: { id },
      relations: ['merchandiser'],
    });

    if (!entity) {
      return null;
    }

    const updatedEntity = await this.merchandiserReferencesRepository.save(
      this.merchandiserReferencesRepository.create(
        MerchandiserReferencesMapper.toPersistence({
          ...MerchandiserReferencesMapper.toDomain(entity),
          ...payload,
        }),
      ),
    );

    return MerchandiserReferencesMapper.toDomain(updatedEntity);
  }

  async remove(id: MerchandiserReferences['id']): Promise<void> {
    await this.merchandiserReferencesRepository.delete(id);
  }
}