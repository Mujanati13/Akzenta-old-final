import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { MerchandiserLanguagesEntity } from '../entities/merchandiser-languages.entity';
import { NullableType } from '../../../../../utils/types/nullable.type';
import { MerchandiserLanguages } from '../../../../domain/merchandiser-languages';
import { MerchandiserLanguagesRepository } from '../../merchandiser-languages.repository';
import { MerchandiserLanguagesMapper } from '../mappers/merchandiser-languages.mapper';
import { IPaginationOptions } from '../../../../../utils/types/pagination-options';

@Injectable()
export class MerchandiserLanguagesRelationalRepository implements MerchandiserLanguagesRepository {
  constructor(
    @InjectRepository(MerchandiserLanguagesEntity)
    private readonly merchandiserLanguagesRepository: Repository<MerchandiserLanguagesEntity>,
  ) {}

  async create(data: Omit<MerchandiserLanguages, 'id' | 'createdAt' | 'updatedAt'>): Promise<MerchandiserLanguages> {
    const persistenceModel = MerchandiserLanguagesMapper.toPersistence({
      ...data,
      id: 0,
      createdAt: new Date(),
      updatedAt: new Date(),
    });
    const newEntity = await this.merchandiserLanguagesRepository.save(
      this.merchandiserLanguagesRepository.create(persistenceModel),
    );
    return MerchandiserLanguagesMapper.toDomain(newEntity);
  }

  async findAllWithPagination({
    paginationOptions,
  }: {
    paginationOptions: IPaginationOptions;
  }): Promise<{ data: MerchandiserLanguages[]; totalCount: number }> {
    const [entities, totalCount] = await this.merchandiserLanguagesRepository.findAndCount({
      skip: (paginationOptions.page - 1) * paginationOptions.limit,
      take: paginationOptions.limit,
      relations: ['merchandiser', 'language'],
    });

    return {
      data: entities.map((entity) => MerchandiserLanguagesMapper.toDomain(entity)),
      totalCount,
    };
  }

  async findById(id: MerchandiserLanguages['id']): Promise<NullableType<MerchandiserLanguages>> {
    const entity = await this.merchandiserLanguagesRepository.findOne({
      where: { id },
      relations: ['merchandiser', 'language'],
    });

    return entity ? MerchandiserLanguagesMapper.toDomain(entity) : null;
  }

  async findByMerchandiserId(merchandiserId: number): Promise<MerchandiserLanguages[]> {
    const entities = await this.merchandiserLanguagesRepository.find({
      where: { merchandiser: { id: merchandiserId } },
      relations: ['merchandiser', 'language'],
    });

    return entities.map((entity) => MerchandiserLanguagesMapper.toDomain(entity));
  }

  async update(
    id: MerchandiserLanguages['id'],
    payload: Partial<MerchandiserLanguages>,
  ): Promise<MerchandiserLanguages | null> {
    const entity = await this.merchandiserLanguagesRepository.findOne({
      where: { id },
      relations: ['merchandiser', 'language'],
    });

    if (!entity) {
      return null;
    }

    const updatedEntity = await this.merchandiserLanguagesRepository.save(
      this.merchandiserLanguagesRepository.create(
        MerchandiserLanguagesMapper.toPersistence({
          ...MerchandiserLanguagesMapper.toDomain(entity),
          ...payload,
        }),
      ),
    );

    return MerchandiserLanguagesMapper.toDomain(updatedEntity);
  }

  async remove(id: MerchandiserLanguages['id']): Promise<void> {
    await this.merchandiserLanguagesRepository.delete(id);
  }
}