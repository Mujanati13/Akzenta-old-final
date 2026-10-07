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
import { UpdateMerchandiserJobTypesDto } from './dto/update-merchandiser-job-types.dto';
import {
  ApiBearerAuth,
  ApiCreatedResponse,
  ApiOkResponse,
  ApiParam,
  ApiTags,
} from '@nestjs/swagger';
import { AuthGuard } from '@nestjs/passport';
import { infinityPagination } from '../utils/infinity-pagination';
import {
  InfinityPaginationResponse,
  InfinityPaginationResponseDto,
} from '../utils/dto/infinity-pagination-response.dto';
import { MerchandiserJobTypesService } from './merchandiser-job-types.service';
import { CreateMerchandiserJobTypesDto } from './dto/create-merchandiser-job-types.dto';
import { MerchandiserJobTypes } from './domain/merchandiser-job-types';
import { FindAllMerchandiserJobTypesDto } from './dto/find-all-merchandiser-job-types.dto';

@ApiTags('MerchandiserJobTypes')
@ApiBearerAuth()
@UseGuards(AuthGuard('jwt'))
@Controller({
  path: 'merchandiser-job-types',
  version: '1',
})
export class MerchandiserJobTypesController {
  constructor(private readonly merchandiserJobTypesService: MerchandiserJobTypesService) {}

  @Post()
  @ApiCreatedResponse({
    type: MerchandiserJobTypes,
  })
  create(@Body() createMerchandiserJobTypesDto: CreateMerchandiserJobTypesDto) {
    return this.merchandiserJobTypesService.create(createMerchandiserJobTypesDto);
  }

  @Get()
  @ApiOkResponse({
    type: InfinityPaginationResponse(MerchandiserJobTypes),
  })
  async findAll(
    @Query() query: FindAllMerchandiserJobTypesDto,
  ): Promise<InfinityPaginationResponseDto<MerchandiserJobTypes>> {
    const page = query?.page ?? 1;
    let limit = query?.limit ?? 10;
    if (limit > 50) {
      limit = 50;
    }

    const { data } = await this.merchandiserJobTypesService.findAllWithPagination({
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
    type: MerchandiserJobTypes,
  })
  findById(@Param('id') id: number) {
    return this.merchandiserJobTypesService.findById(id);
  }

  @Get('merchandiser/:merchandiserId')
  @ApiParam({
    name: 'merchandiserId',
    type: Number,
    required: true,
  })
  @ApiOkResponse({
    type: [MerchandiserJobTypes],
  })
  findByMerchandiserId(@Param('merchandiserId') merchandiserId: number) {
    return this.merchandiserJobTypesService.findByMerchandiserId(merchandiserId);
  }

  @Patch(':id')
  @ApiParam({
    name: 'id',
    type: Number,
    required: true,
  })
  @ApiOkResponse({
    type: MerchandiserJobTypes,
  })
  update(@Param('id') id: number, @Body() updateMerchandiserJobTypesDto: UpdateMerchandiserJobTypesDto) {
    return this.merchandiserJobTypesService.update(id, updateMerchandiserJobTypesDto);
  }

  @Delete(':id')
  @ApiParam({
    name: 'id',
    type: Number,
    required: true,
  })
  remove(@Param('id') id: number) {
    return this.merchandiserJobTypesService.remove(id);
  }
}