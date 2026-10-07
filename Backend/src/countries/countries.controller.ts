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
import { CountriesService } from './countries.service';
import { CreateCountriesDto } from './dto/create-countries.dto';
import { UpdateCountriesDto } from './dto/update-countries.dto';
import {
  ApiBearerAuth,
  ApiCreatedResponse,
  ApiOkResponse,
  ApiParam,
  ApiTags,
} from '@nestjs/swagger';
import { Countries } from './domain/countries';
import { AuthGuard } from '@nestjs/passport';
import {
  InfinityPaginationResponse,
  InfinityPaginationResponseDto,
} from '../utils/dto/infinity-pagination-response.dto';
import { infinityPagination } from '../utils/infinity-pagination';
import { FindAllCountriesDto } from './dto/find-all-countries.dto';
import { I18n, I18nContext } from 'nestjs-i18n';

@ApiTags('Countries')
@ApiBearerAuth()
@UseGuards(AuthGuard('jwt'))
@Controller({
  path: 'countries',
  version: '1',
})
export class CountriesController {
  constructor(private readonly countriesService: CountriesService) {}

  @Post()
  @ApiCreatedResponse({
    type: Countries,
  })
  create(@Body() createCountriesDto: CreateCountriesDto) {
    return this.countriesService.create(createCountriesDto);
  }

  @Get()
  @ApiOkResponse({
    type: InfinityPaginationResponse(Countries),
  })
  async findAll(
    @Query() query: FindAllCountriesDto,
    @I18n() i18n: I18nContext,
  ): Promise<InfinityPaginationResponseDto<Countries>> {
    const page = query?.page ?? 1;
    let limit = query?.limit ?? 0;
    if (limit > 50) {
      limit = 50;
    }
    const { data } = await this.countriesService.findAllWithPagination({
      paginationOptions: {
        page,
        limit,
      },
      i18n: i18n.lang,
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
    type: Countries,
  })
  findById(@Param('id') id: number) {
    return this.countriesService.findById(id);
  }

  @Patch(':id')
  @ApiParam({
    name: 'id',
    type: Number,
    required: true,
  })
  @ApiOkResponse({
    type: Countries,
  })
  update(
    @Param('id') id: number,
    @Body() updateCountriesDto: UpdateCountriesDto,
  ) {
    return this.countriesService.update(id, updateCountriesDto);
  }

  @Delete(':id')
  @ApiParam({
    name: 'id',
    type: Number,
    required: true,
  })
  remove(@Param('id') id: number) {
    return this.countriesService.remove(id);
  }
}
