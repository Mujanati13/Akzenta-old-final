import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { QuestionEntity } from '../entities/question.entity';
import { NullableType } from '../../../../../utils/types/nullable.type';
import { Question } from '../../../../domain/question';
import { QuestionRepository } from '../../question.repository';
import { QuestionMapper } from '../mappers/question.mapper';
import { IPaginationOptions } from '../../../../../utils/types/pagination-options';

@Injectable()
export class QuestionRelationalRepository implements QuestionRepository {
  constructor(
    @InjectRepository(QuestionEntity)
    private readonly questionRepository: Repository<QuestionEntity>,
  ) {}

  async create(data: Omit<Question, 'id' | 'createdAt' | 'updatedAt'>): Promise<Question> {
    const persistenceModel = QuestionMapper.toPersistence({
      ...data,
      id: 0,
      createdAt: new Date(),
      updatedAt: new Date(),
    });
    const newEntity = await this.questionRepository.save(
      this.questionRepository.create(persistenceModel),
    );
    return QuestionMapper.toDomain(newEntity);
  }

  async findAllWithPagination({
    paginationOptions,
  }: {
    paginationOptions: IPaginationOptions;
  }): Promise<{ data: Question[]; totalCount: number }> {
    const [entities, totalCount] = await this.questionRepository.findAndCount({
      skip: (paginationOptions.page - 1) * paginationOptions.limit,
      take: paginationOptions.limit,
      relations: ['project', 'answerType'],
    });

    return {
      data: entities.map((entity) => QuestionMapper.toDomain(entity)),
      totalCount,
    };
  }

  async findById(id: Question['id']): Promise<NullableType<Question>> {
    const entity = await this.questionRepository.findOne({
      where: { id },
      relations: ['project', 'answerType'],
    });

    return entity ? QuestionMapper.toDomain(entity) : null;
  }

  async findByProjectId(projectId: number): Promise<Question[]> {
    const entities = await this.questionRepository.find({
      where: { project: { id: projectId } },
      relations: ['project', 'answerType'],
      order: { createdAt: 'ASC' },
    });

    return entities.map((entity) => QuestionMapper.toDomain(entity));
  }

  async update(
    id: Question['id'],
    payload: Partial<Question>,
  ): Promise<Question | null> {
    const entity = await this.questionRepository.findOne({
      where: { id },
      relations: ['project', 'answerType'],
    });

    if (!entity) {
      return null;
    }

    const updatedEntity = await this.questionRepository.save(
      this.questionRepository.create(
        QuestionMapper.toPersistence({
          ...QuestionMapper.toDomain(entity),
          ...payload,
        }),
      ),
    );

    return QuestionMapper.toDomain(updatedEntity);
  }

  async remove(id: Question['id']): Promise<void> {
    await this.questionRepository.delete(id);
  }
}