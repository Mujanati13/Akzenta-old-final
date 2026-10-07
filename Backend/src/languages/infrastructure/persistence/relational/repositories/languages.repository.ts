import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, In } from 'typeorm';
import { LanguagesEntity } from '../entities/languages.entity';
import { NullableType } from '../../../../../utils/types/nullable.type';
import { Languages } from '../../../../domain/languages';
import { LanguagesRepository } from '../../languages.repository';
import { LanguagesMapper } from '../mappers/languages.mapper';
import { IPaginationOptions } from '../../../../../utils/types/pagination-options';

@Injectable()
export class LanguagesRelationalRepository implements LanguagesRepository {
  constructor(
    @InjectRepository(LanguagesEntity)
    private readonly languagesRepository: Repository<LanguagesEntity>,
  ) {}

  async create(data: Omit<Languages, 'id' | 'createdAt' | 'updatedAt'>): Promise<Languages> {
    const persistenceModel = LanguagesMapper.toPersistence({
      ...data,
      id: 0,
      createdAt: new Date(),
      updatedAt: new Date(),
    });
    const newEntity = await this.languagesRepository.save(
      this.languagesRepository.create(persistenceModel),
    );
    return LanguagesMapper.toDomain(newEntity);
  }

  async findAllWithPagination({
    paginationOptions,
  }: {
    paginationOptions: IPaginationOptions;
  }): Promise<{ data: Languages[]; totalCount: number }> {
    const shouldPaginate =
      !!paginationOptions.limit && paginationOptions.limit > 0;

    const [entities, totalCount] = await this.languagesRepository.findAndCount({
      skip: shouldPaginate
        ? (paginationOptions.page - 1) * paginationOptions.limit
        : undefined,
      take: shouldPaginate ? paginationOptions.limit : undefined,
    });

    return {
      data: entities.map((entity) => LanguagesMapper.toDomain(entity)),
      totalCount,
    };
  }

  async findById(id: Languages['id']): Promise<NullableType<Languages>> {
    const entity = await this.languagesRepository.findOne({
      where: { id },
    });

    return entity ? LanguagesMapper.toDomain(entity) : null;
  }

  async findByIds(ids: Languages['id'][]): Promise<Languages[]> {
    const entities = await this.languagesRepository.find({
      where: { id: In(ids) },
    });

    return entities.map((entity) => LanguagesMapper.toDomain(entity));
  }

  async update(
    id: Languages['id'],
    payload: Partial<Languages>,
  ): Promise<Languages | null> {
    const entity = await this.languagesRepository.findOne({
      where: { id },
    });

    if (!entity) {
      return null;
    }

    const updatedEntity = await this.languagesRepository.save(
      this.languagesRepository.create(
        LanguagesMapper.toPersistence({
          ...LanguagesMapper.toDomain(entity),
          ...payload,
        }),
      ),
    );

    return LanguagesMapper.toDomain(updatedEntity);
  }

  async remove(id: Languages['id']): Promise<void> {
    await this.languagesRepository.delete(id);
  }
}