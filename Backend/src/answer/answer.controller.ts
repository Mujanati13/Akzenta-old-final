import {
  Controller,
  Get,
  Post,
  Body,
  Patch,
  Param,
  Delete,
  UseGuards,
  Query,
} from '@nestjs/common';
import { AnswerService } from './answer.service';
import { CreateAnswerDto } from './dto/create-answer.dto';
import { UpdateAnswerDto } from './dto/update-answer.dto';
import { FindAllAnswerDto } from './dto/find-all-answer.dto';
import {
  ApiBearerAuth,
  ApiCreatedResponse,
  ApiOkResponse,
  ApiParam,
  ApiTags,
} from '@nestjs/swagger';
import { Answer } from './domain/answer';
import { AuthGuard } from '@nestjs/passport';
import { infinityPagination } from '../utils/infinity-pagination';
import {
  InfinityPaginationResponse,
  InfinityPaginationResponseDto,
} from '../utils/dto/infinity-pagination-response.dto';

@ApiTags('Answer')
@ApiBearerAuth()
@UseGuards(AuthGuard('jwt'))
@Controller({
  path: 'answer',
  version: '1',
})
export class AnswerController {
  constructor(private readonly answerService: AnswerService) {}

  @Post()
  @ApiCreatedResponse({
    type: Answer,
  })
  create(@Body() createAnswerDto: CreateAnswerDto) {
    return this.answerService.create(createAnswerDto);
  }

  @Get()
  @ApiOkResponse({
    type: InfinityPaginationResponse(Answer),
  })
  async findAll(
    @Query() query: FindAllAnswerDto,
  ): Promise<InfinityPaginationResponseDto<Answer>> {
    const page = query?.page ?? 1;
    let limit = query?.limit ?? 10;
    if (limit > 50) {
      limit = 50;
    }

    const { data } = await this.answerService.findAllWithPagination({
      paginationOptions: {
        page,
        limit,
      },
    });

    return infinityPagination(data, { page, limit });
  }

  @Get(':id')
  @ApiParam({
    name: 'id',
    type: Number,
    required: true,
  })
  @ApiOkResponse({
    type: Answer,
  })
  findById(@Param('id') id: number) {
    return this.answerService.findById(id);
  }

  @Get('question/:questionId')
  @ApiParam({
    name: 'questionId',
    type: Number,
    required: true,
  })
  @ApiOkResponse({
    type: [Answer],
  })
  findByQuestionId(@Param('questionId') questionId: number) {
    return this.answerService.findByQuestionId(questionId);
  }

  @Patch(':id')
  @ApiParam({
    name: 'id',
    type: Number,
    required: true,
  })
  @ApiOkResponse({
    type: Answer,
  })
  update(@Param('id') id: number, @Body() updateAnswerDto: UpdateAnswerDto) {
    return this.answerService.update(id, updateAnswerDto);
  }

  @Delete(':id')
  @ApiParam({
    name: 'id',
    type: Number,
    required: true,
  })
  remove(@Param('id') id: number) {
    return this.answerService.remove(id);
  }
}