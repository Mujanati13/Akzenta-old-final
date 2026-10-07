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
import {
  ApiTags,
  ApiCreatedResponse,
  ApiOkResponse,
  ApiParam,
  ApiBearerAuth,
} from '@nestjs/swagger';
import { AuthGuard } from '@nestjs/passport';
import { MerchandiserFavoriteClientCompanyService } from './merchandiser-favorite-client-companies.service';
import { CreateMerchandiserFavoriteClientCompanyDto } from './dto/create-merchandiser-favorite-client-company.dto';
import { UpdateMerchandiserFavoriteClientCompanyDto } from './dto/update-merchandiser-favorite-client-company.dto';
import { MerchandiserFavoriteClientCompany } from './domain/merchandiser-favorite-client-company';
import { FindAllMerchandiserFavoriteClientCompanyDto } from './dto/find-all-merchandiser-favorite-client-company.dto';
import {
  InfinityPaginationResponse,
  InfinityPaginationResponseDto,
} from '../utils/dto/infinity-pagination-response.dto';
import { infinityPagination } from '../utils/infinity-pagination';

@ApiTags('MerchandiserFavoriteClientCompany')
@ApiBearerAuth()
@UseGuards(AuthGuard('jwt'))
@Controller({
  path: 'merchandiser-favorite-client-company',
  version: '1',
})
export class MerchandiserFavoriteClientCompanyController {
  constructor(
    private readonly merchandiserFavoriteClientCompanyService: MerchandiserFavoriteClientCompanyService,
  ) {}

  @Post()
  @ApiCreatedResponse({
    type: MerchandiserFavoriteClientCompany,
  })
  async create(
    @Body() createMerchandiserFavoriteClientCompanyDto: CreateMerchandiserFavoriteClientCompanyDto,
  ) {
    return this.merchandiserFavoriteClientCompanyService.create(
      createMerchandiserFavoriteClientCompanyDto,
    );
  }

  @Get()
  @ApiOkResponse({
    type: InfinityPaginationResponse(MerchandiserFavoriteClientCompany),
  })
  async findAll(
    @Query() query: FindAllMerchandiserFavoriteClientCompanyDto,
  ): Promise<InfinityPaginationResponseDto<MerchandiserFavoriteClientCompany>> {
    const page = query?.page ?? 1;
    let limit = query?.limit ?? 50;
    if (limit > 50) {
      limit = 50;
    }

    const { data } = await this.merchandiserFavoriteClientCompanyService.findAllWithPagination({
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
    type: MerchandiserFavoriteClientCompany,
  })
  findById(@Param('id') id: number) {
    return this.merchandiserFavoriteClientCompanyService.findById(id);
  }

  @Patch(':id')
  @ApiParam({
    name: 'id',
    type: Number,
    required: true,
  })
  @ApiOkResponse({
    type: MerchandiserFavoriteClientCompany,
  })
  update(
    @Param('id') id: number,
    @Body() updateMerchandiserFavoriteClientCompanyDto: UpdateMerchandiserFavoriteClientCompanyDto,
  ) {
    return this.merchandiserFavoriteClientCompanyService.update(
      id,
      updateMerchandiserFavoriteClientCompanyDto,
    );
  }

  @Delete(':id')
  @ApiParam({
    name: 'id',
    type: Number,
    required: true,
  })
  remove(@Param('id') id: number) {
    return this.merchandiserFavoriteClientCompanyService.remove(id);
  }
}
