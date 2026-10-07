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
import { ClientFavoriteReportsService } from './client-favorite-reports.service';
import { CreateClientFavoriteReportDto } from './dto/create-client-favorite-report.dto';
import { UpdateClientFavoriteReportDto } from './dto/update-client-favorite-report.dto';
import {
  ApiBearerAuth,
  ApiCreatedResponse,
  ApiOkResponse,
  ApiParam,
  ApiTags,
} from '@nestjs/swagger';
import { ClientFavoriteReport } from './domain/client-favorite-report';
import { AuthGuard } from '@nestjs/passport';
import {
  InfinityPaginationResponse,
  InfinityPaginationResponseDto,
} from '../utils/dto/infinity-pagination-response.dto';
import { infinityPagination } from '../utils/infinity-pagination';
import { FindAllClientFavoriteReportsDto } from './dto/find-all-client-favorite-repors.dto';

@ApiTags('ClientFavoriteReports')
@ApiBearerAuth()
@UseGuards(AuthGuard('jwt'))
@Controller({
  path: 'client-favorite-reports',
  version: '1',
})
export class ClientFavoriteReportsController {
  constructor(
    private readonly clientFavoriteReportsService: ClientFavoriteReportsService,
  ) {}

  @Post()
  @ApiCreatedResponse({
    type: ClientFavoriteReport,
  })
  create(@Body() createClientFavoriteReportDto: CreateClientFavoriteReportDto) {
    return this.clientFavoriteReportsService.create(createClientFavoriteReportDto);
  }

  @Get()
  @ApiOkResponse({
    type: InfinityPaginationResponse(ClientFavoriteReport),
  })
  async findAll(
    @Query() query: FindAllClientFavoriteReportsDto,
  ): Promise<InfinityPaginationResponseDto<ClientFavoriteReport>> {
    const page = query?.page ?? 1;
    let limit = query?.limit ?? 10;
    if (limit > 50) {
      limit = 50;
    }

    return infinityPagination(
      await this.clientFavoriteReportsService.findAllWithPagination({
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
    type: ClientFavoriteReport,
  })
  findById(@Param('id') id: string) {
    return this.clientFavoriteReportsService.findById(+id);
  }

  @Patch(':id')
  @ApiParam({
    name: 'id',
    type: String,
    required: true,
  })
  @ApiOkResponse({
    type: ClientFavoriteReport,
  })
  update(
    @Param('id') id: string,
    @Body() updateClientFavoriteReportDto: UpdateClientFavoriteReportDto,
  ) {
    return this.clientFavoriteReportsService.update(+id, updateClientFavoriteReportDto);
  }

  @Delete(':id')
  @ApiParam({
    name: 'id',
    type: String,
    required: true,
  })
  remove(@Param('id') id: string) {
    return this.clientFavoriteReportsService.remove(+id);
  }
}
