import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { QuestionOptionEntity } from '../entities/question-option.entity';
import { NullableType } from '../../../../../utils/types/nullable.type';
import { QuestionOption } from '../../../../domain/question-option';
import { QuestionOptionRepository } from '../../question-option.repository';
import { QuestionOptionMapper } from '../mappers/question-option.mapper';
import { IPaginationOptions } from '../../../../../utils/types/pagination-options';

@Injectable()
export class QuestionOptionRelationalRepository implements QuestionOptionRepository {
  constructor(
    @InjectRepository(QuestionOptionEntity)
    private readonly questionOptionRepository: Repository<QuestionOptionEntity>,
  ) {}

  async create(data: Omit<QuestionOption, 'id' | 'createdAt' | 'updatedAt'>): Promise<QuestionOption> {
    const persistenceModel = QuestionOptionMapper.toPersistence({
      ...data,
      id: 0,
      createdAt: new Date(),
      updatedAt: new Date(),
    });
    const newEntity = await this.questionOptionRepository.save(
      this.questionOptionRepository.create(persistenceModel),
    );
    return QuestionOptionMapper.toDomain(newEntity);
  }

  async findAllWithPagination({
    paginationOptions,
  }: {
    paginationOptions: IPaginationOptions;
  }): Promise<{ data: QuestionOption[]; totalCount: number }> {
    const [entities, totalCount] = await this.questionOptionRepository.findAndCount({
      skip: (paginationOptions.page - 1) * paginationOptions.limit,
      take: paginationOptions.limit,
      relations: ['question'],
      order: { order: 'ASC' },
    });

    return {
      data: entities.map((entity) => QuestionOptionMapper.toDomain(entity)),
      totalCount,
    };
  }

  async findById(id: QuestionOption['id']): Promise<NullableType<QuestionOption>> {
    const entity = await this.questionOptionRepository.findOne({
      where: { id },
      relations: ['question'],
    });

    return entity ? QuestionOptionMapper.toDomain(entity) : null;
  }

  async findByQuestionId(questionId: number): Promise<QuestionOption[]> {
    const entities = await this.questionOptionRepository.find({
      where: { question: { id: questionId } },
      relations: ['question'],
      order: { order: 'ASC' },
    });

    return entities.map((entity) => QuestionOptionMapper.toDomain(entity));
  }

  async update(
    id: QuestionOption['id'],
    payload: Partial<QuestionOption>,
  ): Promise<QuestionOption | null> {
    const entity = await this.questionOptionRepository.findOne({
      where: { id },
      relations: ['question'],
    });

    if (!entity) {
      return null;
    }

    const updatedEntity = await this.questionOptionRepository.save(
      this.questionOptionRepository.create(
        QuestionOptionMapper.toPersistence({
          ...QuestionOptionMapper.toDomain(entity),
          ...payload,
        }),
      ),
    );

    return QuestionOptionMapper.toDomain(updatedEntity);
  }

  async remove(id: QuestionOption['id']): Promise<void> {
    await this.questionOptionRepository.delete(id);
  }
}