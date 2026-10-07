import { Injectable, Inject, forwardRef } from '@nestjs/common';
import { CreateQuestionOptionDto } from './dto/create-question-option.dto';
import { UpdateQuestionOptionDto } from './dto/update-question-option.dto';
import { QuestionOptionRepository } from './infrastructure/persistence/question-option.repository';
import { IPaginationOptions } from '../utils/types/pagination-options';
import { QuestionOption } from './domain/question-option';
import { QuestionService } from '../question/question.service';

@Injectable()
export class QuestionOptionService {
  constructor(
    private readonly questionOptionRepository: QuestionOptionRepository,
    @Inject(forwardRef(() => QuestionService))
    private readonly questionService: QuestionService,
  ) {}

  async create(createQuestionOptionDto: CreateQuestionOptionDto): Promise<QuestionOption> {
    const question = await this.questionService.findById(
      createQuestionOptionDto.question.id,
    );
    if (!question) {
      throw new Error('Question not found');
    }

    return this.questionOptionRepository.create({
      question,
      optionText: createQuestionOptionDto.optionText,
      order: createQuestionOptionDto.order,
    });
  }

  findAllWithPagination({
    paginationOptions,
  }: {
    paginationOptions: IPaginationOptions;
  }) {
    return this.questionOptionRepository.findAllWithPagination({
      paginationOptions: {
        page: paginationOptions.page,
        limit: paginationOptions.limit,
      },
    });
  }

  findById(id: QuestionOption['id']) {
    return this.questionOptionRepository.findById(id);
  }

  findByQuestionId(questionId: number) {
    return this.questionOptionRepository.findByQuestionId(questionId);
  }

  async update(id: QuestionOption['id'], updateQuestionOptionDto: UpdateQuestionOptionDto) {
    let question: any = undefined;

    if (updateQuestionOptionDto.question) {
      const foundQuestion = await this.questionService.findById(
        updateQuestionOptionDto.question.id,
      );
      if (!foundQuestion) {
        throw new Error('Question not found');
      }
      question = foundQuestion;
    }

    return this.questionOptionRepository.update(id, {
      question,
      optionText: updateQuestionOptionDto.optionText,
      order: updateQuestionOptionDto.order,
    });
  }

  remove(id: QuestionOption['id']) {
    return this.questionOptionRepository.remove(id);
  }
}