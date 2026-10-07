import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { AnswerEntity } from '../entities/answer.entity';
import { NullableType } from '../../../../../utils/types/nullable.type';
import { Answer } from '../../../../domain/answer';
import { AnswerRepository } from '../../answer.repository';
import { AnswerMapper } from '../mappers/answer.mapper';
import { IPaginationOptions } from '../../../../../utils/types/pagination-options';

@Injectable()
export class AnswerRelationalRepository implements AnswerRepository {
  constructor(
    @InjectRepository(AnswerEntity)
    private readonly answerRepository: Repository<AnswerEntity>,
  ) {}

  async create(data: Omit<Answer, 'id' | 'createdAt' | 'updatedAt'>): Promise<Answer> {
    const persistenceModel = AnswerMapper.toPersistence({
      ...data,
      id: 0,
      createdAt: new Date(),
      updatedAt: new Date(),
    });
    const newEntity = await this.answerRepository.save(
      this.answerRepository.create(persistenceModel),
    );
    return AnswerMapper.toDomain(newEntity);
  }

  async findAllWithPagination({
    paginationOptions,
  }: {
    paginationOptions: IPaginationOptions;
  }): Promise<{ data: Answer[]; totalCount: number }> {
    const [entities, totalCount] = await this.answerRepository.findAndCount({
      skip: (paginationOptions.page - 1) * paginationOptions.limit,
      take: paginationOptions.limit,
      relations: ['question', 'selectedOption'],
    });

    return {
      data: entities.map((entity) => AnswerMapper.toDomain(entity)),
      totalCount,
    };
  }

  async findById(id: Answer['id']): Promise<NullableType<Answer>> {
    const entity = await this.answerRepository.findOne({
      where: { id },
      relations: ['question', 'selectedOption'],
    });

    return entity ? AnswerMapper.toDomain(entity) : null;
  }

  async findByQuestionId(questionId: number): Promise<Answer[]> {
    const entities = await this.answerRepository.find({
      where: { question: { id: questionId } },
      relations: ['question', 'selectedOption'],
    });

    return entities.map((entity) => AnswerMapper.toDomain(entity));
  }

  async update(
    id: Answer['id'],
    payload: Partial<Answer>,
  ): Promise<Answer | null> {
    const entity = await this.answerRepository.findOne({
      where: { id },
      relations: ['question', 'selectedOption'],
    });

    if (!entity) {
      return null;
    }

    const updatedEntity = await this.answerRepository.save(
      this.answerRepository.create(
        AnswerMapper.toPersistence({
          ...AnswerMapper.toDomain(entity),
          ...payload,
        }),
      ),
    );

    return AnswerMapper.toDomain(updatedEntity);
  }

  async remove(id: Answer['id']): Promise<void> {
    await this.answerRepository.delete(id);
  }

  async deleteByReportId(reportId: number): Promise<void> {
    await this.answerRepository.delete({ report: { id: reportId } });
  }
}