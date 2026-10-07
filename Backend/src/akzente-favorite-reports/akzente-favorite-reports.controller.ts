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
import { AkzenteFavoriteReportsService } from './akzente-favorite-reports.service';
import { CreateAkzenteFavoriteReportDto } from './dto/create-akzente-favorite-report.dto';
import { UpdateAkzenteFavoriteReportDto } from './dto/update-akzente-favorite-report.dto';
import {
  ApiBearerAuth,
  ApiCreatedResponse,
  ApiOkResponse,
  ApiParam,
  ApiTags,
} from '@nestjs/swagger';
import { AkzenteFavoriteReport } from './domain/akzente-favorite-report';
import { AuthGuard } from '@nestjs/passport';
import {
  InfinityPaginationResponse,
  InfinityPaginationResponseDto,
} from '../utils/dto/infinity-pagination-response.dto';
import { infinityPagination } from '../utils/infinity-pagination';
import { FindAllAkzenteFavoriteReportsDto } from './dto/find-all-akzente-favorite-repors.dto';

@ApiTags('AkzenteFavoriteReports')
@ApiBearerAuth()
@UseGuards(AuthGuard('jwt'))
@Controller({
  path: 'akzente-favorite-reports',
  version: '1',
})
export class AkzenteFavoriteReportsController {
  constructor(
    private readonly akzenteFavoriteReportsService: AkzenteFavoriteReportsService,
  ) {}

  @Post()
  @ApiCreatedResponse({
    type: AkzenteFavoriteReport,
  })
  create(@Body() createAkzenteFavoriteReportDto: CreateAkzenteFavoriteReportDto) {
    return this.akzenteFavoriteReportsService.create(createAkzenteFavoriteReportDto);
  }

  @Get()
  @ApiOkResponse({
    type: InfinityPaginationResponse(AkzenteFavoriteReport),
  })
  async findAll(
    @Query() query: FindAllAkzenteFavoriteReportsDto,
  ): Promise<InfinityPaginationResponseDto<AkzenteFavoriteReport>> {
    const page = query?.page ?? 1;
    let limit = query?.limit ?? 10;
    if (limit > 50) {
      limit = 50;
    }

    return infinityPagination(
      await this.akzenteFavoriteReportsService.findAllWithPagination({
        paginationOptions: {
          page,
          limit,
        },
      }),
      { page, limit },
    );
  }

  @Get(':id')
  @ApiParam({
    name: 'id',
    type: String,
    required: true,
  })
  @ApiOkResponse({
    type: AkzenteFavoriteReport,
  })
  findById(@Param('id') id: string) {
    return this.akzenteFavoriteReportsService.findById(+id);
  }

  @Patch(':id')
  @ApiParam({
    name: 'id',
    type: String,
    required: true,
  })
  @ApiOkResponse({
    type: AkzenteFavoriteReport,
  })
  update(
    @Param('id') id: string,
    @Body() updateAkzenteFavoriteReportDto: UpdateAkzenteFavoriteReportDto,
  ) {
    return this.akzenteFavoriteReportsService.update(+id, updateAkzenteFavoriteReportDto);
  }

  @Delete(':id')
  @ApiParam({
    name: 'id',
    type: String,
    required: true,
  })
  remove(@Param('id') id: string) {
    return this.akzenteFavoriteReportsService.remove(+id);
  }
}
