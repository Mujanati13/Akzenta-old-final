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
import { QuestionOptionService } from './question-option.service';
import { CreateQuestionOptionDto } from './dto/create-question-option.dto';
import { UpdateQuestionOptionDto } from './dto/update-question-option.dto';
import { FindAllQuestionOptionDto } from './dto/find-all-question-option.dto';
import {
  ApiBearerAuth,
  ApiCreatedResponse,
  ApiOkResponse,
  ApiParam,
  ApiTags,
} from '@nestjs/swagger';
import { QuestionOption } from './domain/question-option';
import { AuthGuard } from '@nestjs/passport';
import { infinityPagination } from '../utils/infinity-pagination';
import {
  InfinityPaginationResponse,
  InfinityPaginationResponseDto,
} from '../utils/dto/infinity-pagination-response.dto';

@ApiTags('QuestionOption')
@ApiBearerAuth()
@UseGuards(AuthGuard('jwt'))
@Controller({
  path: 'question-option',
  version: '1',
})
export class QuestionOptionController {
  constructor(private readonly questionOptionService: QuestionOptionService) {}

  @Post()
  @ApiCreatedResponse({
    type: QuestionOption,
  })
  create(@Body() createQuestionOptionDto: CreateQuestionOptionDto) {
    return this.questionOptionService.create(createQuestionOptionDto);
  }

  @Get()
  @ApiOkResponse({
    type: InfinityPaginationResponse(QuestionOption),
  })
  async findAll(
    @Query() query: FindAllQuestionOptionDto,
  ): Promise<InfinityPaginationResponseDto<QuestionOption>> {
    const page = query?.page ?? 1;
    let limit = query?.limit ?? 10;
    if (limit > 50) {
      limit = 50;
    }

    const { data } = await this.questionOptionService.findAllWithPagination({
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
    type: QuestionOption,
  })
  findById(@Param('id') id: number) {
    return this.questionOptionService.findById(id);
  }

  @Get('question/:questionId')
  @ApiParam({
    name: 'questionId',
    type: Number,
    required: true,
  })
  @ApiOkResponse({
    type: [QuestionOption],
  })
  findByQuestionId(@Param('questionId') questionId: number) {
    return this.questionOptionService.findByQuestionId(questionId);
  }

  @Patch(':id')
  @ApiParam({
    name: 'id',
    type: Number,
    required: true,
  })
  @ApiOkResponse({
    type: QuestionOption,
  })
  update(@Param('id') id: number, @Body() updateQuestionOptionDto: UpdateQuestionOptionDto) {
    return this.questionOptionService.update(id, updateQuestionOptionDto);
  }

  @Delete(':id')
  @ApiParam({
    name: 'id',
    type: Number,
    required: true,
  })
  remove(@Param('id') id: number) {
    return this.questionOptionService.remove(id);
  }
}