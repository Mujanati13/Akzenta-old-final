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
import { AnswerTypeService } from './answer-type.service';
import { CreateAnswerTypeDto } from './dto/create-answer-type.dto';
import { UpdateAnswerTypeDto } from './dto/update-answer-type.dto';
import { FindAllAnswerTypeDto } from './dto/find-all-answer-type.dto';
import {
  ApiBearerAuth,
  ApiCreatedResponse,
  ApiOkResponse,
  ApiParam,
  ApiTags,
} from '@nestjs/swagger';
import { AnswerType } from './domain/answer-type';
import { AuthGuard } from '@nestjs/passport';
import { infinityPagination } from '../utils/infinity-pagination';
import {
  InfinityPaginationResponse,
  InfinityPaginationResponseDto,
} from '../utils/dto/infinity-pagination-response.dto';

@ApiTags('AnswerType')
@ApiBearerAuth()
@UseGuards(AuthGuard('jwt'))
@Controller({
  path: 'answer-type',
  version: '1',
})
export class AnswerTypeController {
  constructor(private readonly answerTypeService: AnswerTypeService) {}

  @Post()
  @ApiCreatedResponse({
    type: AnswerType,
  })
  create(@Body() createAnswerTypeDto: CreateAnswerTypeDto) {
    return this.answerTypeService.create(createAnswerTypeDto);
  }

  @Get()
  @ApiOkResponse({
    type: InfinityPaginationResponse(AnswerType),
  })
  async findAll(
    @Query() query: FindAllAnswerTypeDto,
  ): Promise<InfinityPaginationResponseDto<AnswerType>> {
    const page = query?.page ?? 1;
    let limit = query?.limit ?? 10;
    if (limit > 50) {
      limit = 50;
    }

    const { data } = await this.answerTypeService.findAllWithPagination({
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
    type: AnswerType,
  })
  findById(@Param('id') id: number) {
    return this.answerTypeService.findById(id);
  }

  @Patch(':id')
  @ApiParam({
    name: 'id',
    type: Number,
    required: true,
  })
  @ApiOkResponse({
    type: AnswerType,
  })
  update(@Param('id') id: number, @Body() updateAnswerTypeDto: UpdateAnswerTypeDto) {
    return this.answerTypeService.update(id, updateAnswerTypeDto);
  }

  @Delete(':id')
  @ApiParam({
    name: 'id',
    type: Number,
    required: true,
  })
  remove(@Param('id') id: number) {
    return this.answerTypeService.remove(id);
  }
}