import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { AnswerTypeEntity } from '../entities/answer-type.entity';
import { NullableType } from '../../../../../utils/types/nullable.type';
import { AnswerType } from '../../../../domain/answer-type';
import { AnswerTypeRepository } from '../../answer-type.repository';
import { AnswerTypeMapper } from '../mappers/answer-type.mapper';
import { IPaginationOptions } from '../../../../../utils/types/pagination-options';

@Injectable()
export class AnswerTypeRelationalRepository implements AnswerTypeRepository {
  constructor(
    @InjectRepository(AnswerTypeEntity)
    private readonly answerTypeRepository: Repository<AnswerTypeEntity>,
  ) {}

  async create(data: Omit<AnswerType, 'id'>): Promise<AnswerType> {
    const persistenceModel = AnswerTypeMapper.toPersistence({
      ...data,
      id: 0,
    });
    const newEntity = await this.answerTypeRepository.save(
      this.answerTypeRepository.create(persistenceModel),
    );
    return AnswerTypeMapper.toDomain(newEntity);
  }

  async findAllWithPagination({
    paginationOptions,
  }: {
    paginationOptions: IPaginationOptions;
  }): Promise<{ data: AnswerType[]; totalCount: number }> {
    const [entities, totalCount] = await this.answerTypeRepository.findAndCount({
      skip: (paginationOptions.page - 1) * paginationOptions.limit,
      take: paginationOptions.limit,
    });

    return {
      data: entities.map((entity) => AnswerTypeMapper.toDomain(entity)),
      totalCount,
    };
  }

  async findById(id: AnswerType['id']): Promise<NullableType<AnswerType>> {
    const entity = await this.answerTypeRepository.findOne({
      where: { id },
    });

    return entity ? AnswerTypeMapper.toDomain(entity) : null;
  }

  async update(
    id: AnswerType['id'],
    payload: Partial<AnswerType>,
  ): Promise<AnswerType | null> {
    const entity = await this.answerTypeRepository.findOne({
      where: { id },
    });

    if (!entity) {
      return null;
    }

    const updatedEntity = await this.answerTypeRepository.save(
      this.answerTypeRepository.create(
        AnswerTypeMapper.toPersistence({
          ...AnswerTypeMapper.toDomain(entity),
          ...payload,
        }),
      ),
    );

    return AnswerTypeMapper.toDomain(updatedEntity);
  }

  async remove(id: AnswerType['id']): Promise<void> {
    await this.answerTypeRepository.delete(id);
  }
}