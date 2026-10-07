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
import { CitiesService } from './cities.service';
import { CreateCitiesDto } from './dto/create-cities.dto';
import { UpdateCitiesDto } from './dto/update-cities.dto';
import {
  ApiBearerAuth,
  ApiCreatedResponse,
  ApiOkResponse,
  ApiParam,
  ApiTags,
} from '@nestjs/swagger';
import { Cities } from './domain/cities';
import { AuthGuard } from '@nestjs/passport';
import {
  InfinityPaginationResponse,
  InfinityPaginationResponseDto,
} from '../utils/dto/infinity-pagination-response.dto';
import { infinityPagination } from '../utils/infinity-pagination';
import { FindAllCitiesDto } from './dto/find-all-cities.dto';
import { Public } from '../roles/public.decorator';
import { Roles } from '../roles/roles.decorator';
import { RoleEnum } from '../roles/roles.enum';
import { RolesGuard } from '../roles/roles.guard';
import { SessionCheckGuard } from '../roles/session-check.guard';

@ApiTags('Cities')
@ApiBearerAuth()
@Roles(RoleEnum.admin, RoleEnum.user)
@UseGuards(RolesGuard, SessionCheckGuard)
@Controller({
  path: 'cities',
  version: '1',
})
export class CitiesController {
  constructor(private readonly citiesService: CitiesService) {}

  @Post()
  @ApiCreatedResponse({
    type: Cities,
  })
  create(@Body() createCitiesDto: CreateCitiesDto) {
    return this.citiesService.create(createCitiesDto);
  }

  @Get()
  @ApiOkResponse({
    type: InfinityPaginationResponse(Cities),
  })
  async findAll(
    @Query() query: FindAllCitiesDto,
  ): Promise<InfinityPaginationResponseDto<Cities>> {
    const page = query?.page ?? 1;
    let limit = query?.limit ?? 10;
    if (limit > 50) {
      limit = 50;
    }
    const { data } = await this.citiesService.findAllWithPagination({
      paginationOptions: {
        page,
        limit,
      },
    });
    return infinityPagination(data, { page, limit });
  }

  @Public()
  @Get('country/:countryId')
  @ApiParam({
    name: 'countryId',
    type: Number,
    required: true,
  })
  @ApiOkResponse({
    type: [Cities],
  })
  findByCountryId(@Param('countryId') countryId: number) {
    return this.citiesService.findByCountryId(countryId);
  }

  @Get(':id')
  @ApiParam({
    name: 'id',
    type: Number,
    required: true,
  })
  @ApiOkResponse({
    type: Cities,
  })
  findById(@Param('id') id: number) {
    return this.citiesService.findById(id);
  }

  @Patch(':id')
  @ApiParam({
    name: 'id',
    type: Number,
    required: true,
  })
  @ApiOkResponse({
    type: Cities,
  })
  update(@Param('id') id: number, @Body() updateCitiesDto: UpdateCitiesDto) {
    return this.citiesService.update(id, updateCitiesDto);
  }

  @Delete(':id')
  @ApiParam({
    name: 'id',
    type: Number,
    required: true,
  })
  remove(@Param('id') id: number) {
    return this.citiesService.remove(id);
  }
}