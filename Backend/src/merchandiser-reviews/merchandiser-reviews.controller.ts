import {
  Controller,
  Get,
  Post,
  Body,
  Patch,
  Param,
  Delete,
  Query,
  UseGuards,
  Request,
} from '@nestjs/common';
import { ReviewService } from './merchandiser-reviews.service';
import { CreateReviewDto } from './dto/create-merchandiser-reviews.dto';
import { UpdateReviewDto } from './dto/update-merchandiser-reviews.dto';
import {
  ApiBearerAuth,
  ApiCreatedResponse,
  ApiOkResponse,
  ApiParam,
  ApiTags,
} from '@nestjs/swagger';
import { Review } from './domain/merchandiser-reviews';
import { QueryReviewDto } from './dto/query-merchandiser-reviews.dto';
import { Roles } from '../roles/roles.decorator';
import { RoleEnum } from '../roles/roles.enum';
import { RolesGuard } from '../roles/roles.guard';

@ApiTags('Review')
@ApiBearerAuth()
@Roles(RoleEnum.admin, RoleEnum.user)
@UseGuards(RolesGuard)
@Controller({
  path: 'review',
  version: '1',
})
export class ReviewController {
  constructor(private readonly reviewService: ReviewService) {}

  @Post()
  @ApiCreatedResponse({
    type: Review,
  })
  create(@Body() createReviewDto: CreateReviewDto,@Request() request) {
    return this.reviewService.create(createReviewDto, request.user);
  }

  @Get()
  @ApiOkResponse({
    schema: {
      type: 'object',
      properties: {
        data: {
          type: 'array',
          items: { $ref: '#/components/schemas/Review' },
        },
        hasNextPage: { type: 'boolean' },
        totalCount: { type: 'number' },
      },
    },
  })
  async findAll(@Query() query: QueryReviewDto) {
    const page = query?.page ?? 1;
    let limit = query?.limit ?? 10;
    if (limit > 50) {
      limit = 50;
    }

    const { data, totalCount } = await this.reviewService.findAllWithPagination({
      paginationOptions: {
        page,
        limit,
      },
      filters: query.filters,
      sort: query.sort,
    });

    const hasNextPage = page * limit < totalCount;

    return {
      data,
      hasNextPage,
      totalCount,
    };
  }

  @Get('merchandiser/:merchandiserId')
  @ApiParam({
    name: 'merchandiserId',
    type: Number,
    required: true,
  })
  @ApiOkResponse({
    type: [Review],
  })
  findByMerchandiserId(@Param('merchandiserId') merchandiserId: number) {
    return this.reviewService.findByMerchandiserId(merchandiserId);
  }

  @Get('merchandiser/:merchandiserId/stats')
  @ApiParam({
    name: 'merchandiserId',
    type: Number,
    required: true,
  })
  @ApiOkResponse({
    schema: {
      type: 'object',
      properties: {
        averageRating: { type: 'number' },
        reviewCount: { type: 'number' },
        reviews: { type: 'array', items: { $ref: '#/components/schemas/Review' } },
      },
    },
  })
  getMerchandiserStats(@Param('merchandiserId') merchandiserId: number) {
    return this.reviewService.getMerchandiserStats(merchandiserId);
  }

  @Get('akzente/:akzenteId')
  @ApiParam({
    name: 'akzenteId',
    type: Number,
    required: true,
  })
  @ApiOkResponse({
    type: [Review],
  })
  findByAkzenteId(@Param('akzenteId') akzenteId: number) {
    return this.reviewService.findByAkzenteId(akzenteId);
  }

  @Get(':id')
  @ApiParam({
    name: 'id',
    type: Number,
    required: true,
  })
  @ApiOkResponse({
    type: Review,
  })
  findById(@Param('id') id: number) {
    return this.reviewService.findById(id);
  }

  @Patch(':id')
  @ApiParam({
    name: 'id',
    type: Number,
    required: true,
  })
  @ApiOkResponse({
    type: Review,
  })
  update(@Param('id') id: number, @Body() updateReviewDto: UpdateReviewDto) {
    return this.reviewService.update(id, updateReviewDto);
  }

  @Delete(':id')
  @ApiParam({
    name: 'id',
    type: Number,
    required: true,
  })
  remove(@Param('id') id: number) {
    return this.reviewService.remove(id);
  }
}