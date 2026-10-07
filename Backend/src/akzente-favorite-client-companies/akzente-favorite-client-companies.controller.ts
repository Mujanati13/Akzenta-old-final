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
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { AkzenteFavoriteClientCompaniesService } from './akzente-favorite-client-companies.service';
import { CreateAkzenteFavoriteClientCompanyDto } from './dto/create-akzente-favorite-client-company.dto';
import { UpdateAkzenteFavoriteClientCompanyDto } from './dto/update-akzente-favorite-client-company.dto';
import {
  ApiBearerAuth,
  ApiCreatedResponse,
  ApiOkResponse,
  ApiParam,
  ApiTags,
} from '@nestjs/swagger';
import { AkzenteFavoriteClientCompany } from './domain/akzente-favorite-client-company';
import { AuthGuard } from '@nestjs/passport';
import {
  InfinityPaginationResponse,
  InfinityPaginationResponseDto,
} from '../utils/dto/infinity-pagination-response.dto';
import { infinityPagination } from '../utils/infinity-pagination';
import { FindAllAkzenteFavoriteClientCompaniesDto } from './dto/find-all-akzente-favorite-client-companies.dto';

@ApiTags('AkzenteFavoriteClientCompanies')
@ApiBearerAuth()
@UseGuards(AuthGuard('jwt'))
@Controller({
  path: 'favorite-client-companies',
  version: '1',
})
export class AkzenteFavoriteClientCompaniesController {
  constructor(
    private readonly akzenteFavoriteClientCompaniesService: AkzenteFavoriteClientCompaniesService,
  ) {}

  @Post()
  @ApiCreatedResponse({
    type: AkzenteFavoriteClientCompany,
  })
  create(
    @Body() createFavoriteClientCompanyDto: CreateAkzenteFavoriteClientCompanyDto,
  ) {
    return this.akzenteFavoriteClientCompaniesService.create(
      createFavoriteClientCompanyDto,
    );
  }

  @Get()
  @HttpCode(HttpStatus.OK)
  @ApiOkResponse({
    type: InfinityPaginationResponse(AkzenteFavoriteClientCompany),
  })
  async findAll(
    @Query() query: FindAllAkzenteFavoriteClientCompaniesDto,
  ): Promise<InfinityPaginationResponseDto<AkzenteFavoriteClientCompany>> {
    const page = query?.page ?? 1;
    const limit = query?.limit ? (query.limit > 50 ? 50 : query.limit) : 10;

    const result = await this.akzenteFavoriteClientCompaniesService.findAllWithPagination({
      paginationOptions: {
        page,
        limit,
      },
    });

    return infinityPagination(
      result.data,
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
    type: AkzenteFavoriteClientCompany,
  })
  findById(@Param('id') id: string) {
    return this.akzenteFavoriteClientCompaniesService.findById(+id);
  }

  @Patch(':id')
  @ApiParam({
    name: 'id',
    type: String,
    required: true,
  })
  @ApiOkResponse({
    type: AkzenteFavoriteClientCompany,
  })
  update(
    @Param('id') id: string,
    @Body() updateFavoriteClientCompanyDto: UpdateAkzenteFavoriteClientCompanyDto,
  ) {
    return this.akzenteFavoriteClientCompaniesService.update(
      +id,
      updateFavoriteClientCompanyDto,
    );
  }

  @Delete(':id')
  @ApiParam({
    name: 'id',
    type: String,
    required: true,
  })
  remove(@Param('id') id: string) {
    return this.akzenteFavoriteClientCompaniesService.remove(+id);
  }
}
