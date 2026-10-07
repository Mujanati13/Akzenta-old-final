import {
  Controller,
  Get,
  Post,
  Body,
  Param,
  Delete,
  UseGuards,
  Query,
} from '@nestjs/common';
import { MerchandiserFavoriteReportsService } from './merchandiser-favorite-reports.service';
import { CreateMerchandiserFavoriteReportDto } from './dto/create-merchandiser-favorite-report.dto';
import {
  ApiBearerAuth,
  ApiCreatedResponse,
  ApiOkResponse,
  ApiParam,
  ApiTags,
} from '@nestjs/swagger';
import { MerchandiserFavoriteReports } from './domain/merchandiser-favorite-reports';
import { AuthGuard } from '@nestjs/passport';
import { infinityPagination } from '../utils/infinity-pagination';
import {
  InfinityPaginationResponse,
  InfinityPaginationResponseDto,
} from '../utils/dto/infinity-pagination-response.dto';
import { FindAllMerchandiserFavoriteReportsDto } from './dto/find-all-merchandiser-favorite-reports.dto';

@ApiTags('Favorites')
@ApiBearerAuth()
@UseGuards(AuthGuard('jwt'))
@Controller({
  path: 'favorites',
  version: '1',
})
export class MerchandiserFavoriteReportsController {
  constructor(private readonly merchandiserFavoriteReportsService: MerchandiserFavoriteReportsService) {}

  @Post()
  @ApiCreatedResponse({
    type: MerchandiserFavoriteReports,
  })
  create(@Body() createMerchandiserFavoriteReportDto: CreateMerchandiserFavoriteReportDto) {
    return this.merchandiserFavoriteReportsService.create(createMerchandiserFavoriteReportDto);
  }

  @Get()
  @ApiOkResponse({
    type: InfinityPaginationResponse(MerchandiserFavoriteReports),
  })
  async findAll(
    @Query() query: FindAllMerchandiserFavoriteReportsDto,
  ): Promise<InfinityPaginationResponseDto<MerchandiserFavoriteReports>> {
    const page = query?.page ?? 1;
    let limit = query?.limit ?? 10;
    if (limit > 50) {
      limit = 50;
    }

    const { data } = await this.merchandiserFavoriteReportsService.findAllWithPagination({
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
    type: MerchandiserFavoriteReports,
  })
  findById(@Param('id') id: number) {
    return this.merchandiserFavoriteReportsService.findById(id);
  }

  @Get('merchandiser/:merchandiserId')
  @ApiParam({
    name: 'merchandiserId',
    type: Number,
    required: true,
  })
  @ApiOkResponse({
    type: [MerchandiserFavoriteReports],
  })
  findByMerchandiserId(@Param('merchandiserId') merchandiserId: number) {
    return this.merchandiserFavoriteReportsService.findByMerchandiserId(merchandiserId);
  }

  @Delete(':id')
  @ApiParam({
    name: 'id',
    type: Number,
    required: true,
  })
  remove(@Param('id') id: number) {
    return this.merchandiserFavoriteReportsService.remove(id);
  }
}