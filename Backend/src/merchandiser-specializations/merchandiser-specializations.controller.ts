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
import { MerchandiserSpecializationsService } from './merchandiser-specializations.service';
import { CreateMerchandiserSpecializationsDto } from './dto/create-merchandiser-specializations.dto';
import { UpdateMerchandiserSpecializationsDto } from './dto/update-merchandiser-specializations.dto';
import { FindAllMerchandiserSpecializationsDto } from './dto/find-all-merchandiser-specializations.dto';
import {
  ApiBearerAuth,
  ApiCreatedResponse,
  ApiOkResponse,
  ApiParam,
  ApiTags,
} from '@nestjs/swagger';
import { MerchandiserSpecializations } from './domain/merchandiser-specializations';
import { AuthGuard } from '@nestjs/passport';
import { infinityPagination } from '../utils/infinity-pagination';
import {
  InfinityPaginationResponse,
  InfinityPaginationResponseDto,
} from '../utils/dto/infinity-pagination-response.dto';

@ApiTags('MerchandiserSpecializations')
@ApiBearerAuth()
@UseGuards(AuthGuard('jwt'))
@Controller({
  path: 'merchandiser-specializations',
  version: '1',
})
export class MerchandiserSpecializationsController {
  constructor(private readonly merchandiserSpecializationsService: MerchandiserSpecializationsService) {}

  @Post()
  @ApiCreatedResponse({
    type: MerchandiserSpecializations,
  })
  create(@Body() createMerchandiserSpecializationsDto: CreateMerchandiserSpecializationsDto) {
    return this.merchandiserSpecializationsService.create(createMerchandiserSpecializationsDto);
  }

  @Get()
  @ApiOkResponse({
    type: InfinityPaginationResponse(MerchandiserSpecializations),
  })
  async findAll(
    @Query() query: FindAllMerchandiserSpecializationsDto,
  ): Promise<InfinityPaginationResponseDto<MerchandiserSpecializations>> {
    const page = query?.page ?? 1;
    let limit = query?.limit ?? 10;
    if (limit > 50) {
      limit = 50;
    }

    const { data } = await this.merchandiserSpecializationsService.findAllWithPagination({
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
    type: MerchandiserSpecializations,
  })
  findById(@Param('id') id: number) {
    return this.merchandiserSpecializationsService.findById(id);
  }

  @Get('merchandiser/:merchandiserId')
  @ApiParam({
    name: 'merchandiserId',
    type: Number,
    required: true,
  })
  @ApiOkResponse({
    type: [MerchandiserSpecializations],
  })
  findByMerchandiserId(@Param('merchandiserId') merchandiserId: number) {
    return this.merchandiserSpecializationsService.findByMerchandiserId(merchandiserId);
  }

  @Patch(':id')
  @ApiParam({
    name: 'id',
    type: Number,
    required: true,
  })
  @ApiOkResponse({
    type: MerchandiserSpecializations,
  })
  update(@Param('id') id: number, @Body() updateMerchandiserSpecializationsDto: UpdateMerchandiserSpecializationsDto) {
    return this.merchandiserSpecializationsService.update(id, updateMerchandiserSpecializationsDto);
  }

  @Delete(':id')
  @ApiParam({
    name: 'id',
    type: Number,
    required: true,
  })
  remove(@Param('id') id: number) {
    return this.merchandiserSpecializationsService.remove(id);
  }
}