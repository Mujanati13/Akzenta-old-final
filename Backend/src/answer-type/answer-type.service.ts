import { Injectable } from '@nestjs/common';
import { CreateAnswerTypeDto } from './dto/create-answer-type.dto';
import { UpdateAnswerTypeDto } from './dto/update-answer-type.dto';
import { AnswerTypeRepository } from './infrastructure/persistence/answer-type.repository';
import { IPaginationOptions } from '../utils/types/pagination-options';
import { AnswerType } from './domain/answer-type';

@Injectable()
export class AnswerTypeService {
  constructor(
    private readonly answerTypeRepository: AnswerTypeRepository,
  ) {}

  create(createAnswerTypeDto: CreateAnswerTypeDto): Promise<AnswerType> {
    return this.answerTypeRepository.create({
      name: createAnswerTypeDto.name,
    });
  }

  findAllWithPagination({
    paginationOptions,
  }: {
    paginationOptions: IPaginationOptions;
  }) {
    return this.answerTypeRepository.findAllWithPagination({
      paginationOptions: {
        page: paginationOptions.page,
        limit: paginationOptions.limit,
      },
    });
  }

  findById(id: AnswerType['id']) {
    return this.answerTypeRepository.findById(id);
  }

  update(id: AnswerType['id'], updateAnswerTypeDto: UpdateAnswerTypeDto) {
    return this.answerTypeRepository.update(id, {
      name: updateAnswerTypeDto.name,
    });
  }

  remove(id: AnswerType['id']) {
    return this.answerTypeRepository.remove(id);
  }
}