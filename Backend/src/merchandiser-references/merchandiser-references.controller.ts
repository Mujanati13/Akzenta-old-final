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
import { MerchandiserReferencesService } from './merchandiser-references.service';
import { CreateMerchandiserReferencesDto } from './dto/create-merchandiser-references.dto';
import { UpdateMerchandiserReferencesDto } from './dto/update-merchandiser-references.dto';
import { FindAllMerchandiserReferencesDto } from './dto/find-all-merchandiser-references.dto';
import {
  ApiBearerAuth,
  ApiCreatedResponse,
  ApiOkResponse,
  ApiParam,
  ApiTags,
} from '@nestjs/swagger';
import { MerchandiserReferences } from './domain/merchandiser-references';
import { AuthGuard } from '@nestjs/passport';
import { infinityPagination } from '../utils/infinity-pagination';
import {
  InfinityPaginationResponse,
  InfinityPaginationResponseDto,
} from '../utils/dto/infinity-pagination-response.dto';

@ApiTags('MerchandiserReferences')
@ApiBearerAuth()
@UseGuards(AuthGuard('jwt'))
@Controller({
  path: 'merchandiser-references',
  version: '1',
})
export class MerchandiserReferencesController {
  constructor(private readonly merchandiserReferencesService: MerchandiserReferencesService) {}

  @Post()
  @ApiCreatedResponse({
    type: MerchandiserReferences,
  })
  create(@Body() createMerchandiserReferencesDto: CreateMerchandiserReferencesDto) {
    return this.merchandiserReferencesService.create(createMerchandiserReferencesDto);
  }

  @Get()
  @ApiOkResponse({
    type: InfinityPaginationResponse(MerchandiserReferences),
  })
  async findAll(
    @Query() query: FindAllMerchandiserReferencesDto,
  ): Promise<InfinityPaginationResponseDto<MerchandiserReferences>> {
    const page = query?.page ?? 1;
    let limit = query?.limit ?? 10;
    if (limit > 50) {
      limit = 50;
    }

    const { data } = await this.merchandiserReferencesService.findAllWithPagination({
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
    type: MerchandiserReferences,
  })
  findById(@Param('id') id: number) {
    return this.merchandiserReferencesService.findById(id);
  }

  @Get('merchandiser/:merchandiserId')
  @ApiParam({
    name: 'merchandiserId',
    type: Number,
    required: true,
  })
  @ApiOkResponse({
    type: [MerchandiserReferences],
  })
  findByMerchandiserId(@Param('merchandiserId') merchandiserId: number) {
    return this.merchandiserReferencesService.findByMerchandiserId(merchandiserId);
  }

  @Patch(':id')
  @ApiParam({
    name: 'id',
    type: Number,
    required: true,
  })
  @ApiOkResponse({
    type: MerchandiserReferences,
  })
  update(@Param('id') id: number, @Body() updateMerchandiserReferencesDto: UpdateMerchandiserReferencesDto) {
    return this.merchandiserReferencesService.update(id, updateMerchandiserReferencesDto);
  }

  @Delete(':id')
  @ApiParam({
    name: 'id',
    type: Number,
    required: true,
  })
  remove(@Param('id') id: number) {
    return this.merchandiserReferencesService.remove(id);
  }
}