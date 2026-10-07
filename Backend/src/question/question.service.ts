import { forwardRef, Inject, Injectable } from '@nestjs/common';
import { CreateQuestionDto } from './dto/create-question.dto';
import { UpdateQuestionDto } from './dto/update-question.dto';
import { QuestionRepository } from './infrastructure/persistence/question.repository';
import { IPaginationOptions } from '../utils/types/pagination-options';
import { Question } from './domain/question';
import { ProjectService } from '../project/project.service';
import { AnswerTypeService } from '../answer-type/answer-type.service';
import { Project } from '../project/domain/project';
import { AnswerType } from '../answer-type/domain/answer-type';

@Injectable()
export class QuestionService {
  constructor(
    private readonly questionRepository: QuestionRepository,
    @Inject(forwardRef(() => ProjectService))
    private readonly projectService: ProjectService,
    @Inject(forwardRef(() => AnswerTypeService))
    private readonly answerTypeService: AnswerTypeService,
  ) {}

  async create(createQuestionDto: CreateQuestionDto): Promise<Question> {
    const project = await this.projectService.findById(createQuestionDto.project.id);
    if (!project) {
      throw new Error('Project not found');
    }

    const answerType = await this.answerTypeService.findById(createQuestionDto.answerType.id);
    if (!answerType) {
      throw new Error('Answer type not found');
    }

    return this.questionRepository.create({
      project,
      answerType,
      questionText: createQuestionDto.questionText,
      isRequired: createQuestionDto.isRequired,
      isVisibleToClient: createQuestionDto.isVisibleToClient,
      showInOverview: createQuestionDto.showInOverview,
    });
  }

  findAllWithPagination({
    paginationOptions,
  }: {
    paginationOptions: IPaginationOptions;
  }) {
    return this.questionRepository.findAllWithPagination({
      paginationOptions: {
        page: paginationOptions.page,
        limit: paginationOptions.limit,
      },
    });
  }

  findById(id: Question['id']) {
    return this.questionRepository.findById(id);
  }

  findByProjectId(projectId: number) {
    return this.questionRepository.findByProjectId(projectId);
  }

async update(id: Question['id'], updateQuestionDto: UpdateQuestionDto) {
    let project: Project | undefined = undefined;
    let answerType: AnswerType | undefined = undefined;

    if (updateQuestionDto.project) {
      const foundProject = await this.projectService.findById(updateQuestionDto.project.id);
      if (!foundProject) {
        throw new Error('Project not found');
      }
      project = foundProject;
    }

    if (updateQuestionDto.answerType) {
      const foundAnswerType = await this.answerTypeService.findById(updateQuestionDto.answerType.id);
      if (!foundAnswerType) {
        throw new Error('Answer type not found');
      }
      answerType = foundAnswerType;
    }

    return this.questionRepository.update(id, {
      project,
      answerType,
      questionText: updateQuestionDto.questionText,
      isRequired: updateQuestionDto.isRequired,
      isVisibleToClient: updateQuestionDto.isVisibleToClient,
    });
  }

  remove(id: Question['id']) {
    return this.questionRepository.remove(id);
  }
}