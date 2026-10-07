import { Injectable, Inject, forwardRef } from '@nestjs/common';
import { CreateAnswerDto } from './dto/create-answer.dto';
import { UpdateAnswerDto } from './dto/update-answer.dto';
import { AnswerRepository } from './infrastructure/persistence/answer.repository';
import { IPaginationOptions } from '../utils/types/pagination-options';
import { Answer } from './domain/answer';
import { QuestionService } from '../question/question.service';
import { QuestionOptionService } from '../question-option/question-option.service';
import { ReportService } from '../report/report.service';

@Injectable()
export class AnswerService {
  constructor(
    private readonly answerRepository: AnswerRepository,
    private readonly questionService: QuestionService,
    private readonly questionOptionService: QuestionOptionService,
    @Inject(forwardRef(() => ReportService))
    private readonly reportService: ReportService,
  ) {}

  /**
   * Bulk create answers with optimized performance - pre-fetches all required entities
   * This method is separate from the main create to avoid breaking existing functionality
   */
  async createBulk(answers: any[], reportId: number): Promise<Answer[]> {
    
    // Pre-fetch all required entities to avoid N+1 queries
    const questionIds = answers.map(a => a.questionId);
    const optionIds = answers.filter(a => a.selectedOptionId).map(a => a.selectedOptionId);
    
    const [questions, options] = await Promise.all([
      Promise.all(questionIds.map(qId => this.questionService.findById(qId))),
      optionIds.length > 0 ? Promise.all(optionIds.map(oId => this.questionOptionService.findById(oId))) : []
    ]);
    
    // Create answers with pre-fetched data
    const answerPromises = answers.map(async (answer) => {
      const question = questions.find(q => q?.id === answer.questionId);
      if (!question) {
        throw new Error(`Question ${answer.questionId} not found`);
      }

      const answerPayload: any = {
        question,
        report: { id: reportId },
        textAnswer: answer.textAnswer !== undefined ? answer.textAnswer : null,
      };

      if (answer.selectedOptionId) {
        const selectedOption = (options as any[]).find(o => o?.id === answer.selectedOptionId);
        if (!selectedOption) {
          throw new Error(`Option ${answer.selectedOptionId} not found`);
        }
        answerPayload.selectedOption = selectedOption;
      }

      return this.answerRepository.create(answerPayload);
    });

    const results = await Promise.all(answerPromises);
    return results;
  }

  async create(createAnswerDto: CreateAnswerDto): Promise<Answer> {
    const question = await this.questionService.findById(createAnswerDto.question.id);
    if (!question) {
      throw new Error('Question not found');
    }

    const report = await this.reportService.findById(createAnswerDto.report.id);
    if (!report) {
      throw new Error('Report not found');
    }

    let selectedOption: any = undefined;
    if (createAnswerDto.selectedOption && createAnswerDto.selectedOption.id) {
      selectedOption = await this.questionOptionService.findById(createAnswerDto.selectedOption.id);
      if (!selectedOption) {
        throw new Error('Question option not found');
      }
    }

    const createObj: any = {
      question,
      report,
      textAnswer: createAnswerDto.textAnswer,
    };
    if (selectedOption) {
      createObj.selectedOption = selectedOption;
    }
    return this.answerRepository.create(createObj);
  }

  findAllWithPagination({
    paginationOptions,
  }: {
    paginationOptions: IPaginationOptions;
  }) {
    return this.answerRepository.findAllWithPagination({
      paginationOptions: {
        page: paginationOptions.page,
        limit: paginationOptions.limit,
      },
    });
  }

  findById(id: Answer['id']) {
    return this.answerRepository.findById(id);
  }

  findByQuestionId(questionId: number) {
    return this.answerRepository.findByQuestionId(questionId);
  }

  async update(id: Answer['id'], updateAnswerDto: UpdateAnswerDto) {
    let question: any = undefined;
    let selectedOption: any = undefined;

    if (updateAnswerDto.question) {
      const foundQuestion = await this.questionService.findById(updateAnswerDto.question.id);
      if (!foundQuestion) {
        throw new Error('Question not found');
      }
      question = foundQuestion;
    }

    if (updateAnswerDto.selectedOption) {
      const foundSelectedOption = await this.questionOptionService.findById(updateAnswerDto.selectedOption.id);
      if (!foundSelectedOption) {
        throw new Error('Question option not found');
      }
      selectedOption = foundSelectedOption;
    }

    return this.answerRepository.update(id, {
      question,
      selectedOption,
      textAnswer: updateAnswerDto.textAnswer,
    });
  }

  remove(id: Answer['id']) {
    return this.answerRepository.remove(id);
  }

  deleteByReportId(reportId: number) {
    return this.answerRepository.deleteByReportId(reportId);
  }
}