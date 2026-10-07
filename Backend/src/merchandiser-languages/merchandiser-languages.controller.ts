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
import { MerchandiserLanguagesService } from './merchandiser-languages.service';
import { CreateMerchandiserLanguagesDto } from './dto/create-merchandiser-languages.dto';
import { UpdateMerchandiserLanguagesDto } from './dto/update-merchandiser-languages.dto';
import { FindAllMerchandiserLanguagesDto } from './dto/find-all-merchandiser-languages.dto';
import {
  ApiBearerAuth,
  ApiCreatedResponse,
  ApiOkResponse,
  ApiParam,
  ApiTags,
} from '@nestjs/swagger';
import { MerchandiserLanguages } from './domain/merchandiser-languages';
import { AuthGuard } from '@nestjs/passport';
import { infinityPagination } from '../utils/infinity-pagination';
import {
  InfinityPaginationResponse,
  InfinityPaginationResponseDto,
} from '../utils/dto/infinity-pagination-response.dto';

@ApiTags('MerchandiserLanguages')
@ApiBearerAuth()
@UseGuards(AuthGuard('jwt'))
@Controller({
  path: 'merchandiser-languages',
  version: '1',
})
export class MerchandiserLanguagesController {
  constructor(private readonly merchandiserLanguagesService: MerchandiserLanguagesService) {}

  @Post()
  @ApiCreatedResponse({
    type: MerchandiserLanguages,
  })
  create(@Body() createMerchandiserLanguagesDto: CreateMerchandiserLanguagesDto) {
    return this.merchandiserLanguagesService.create(createMerchandiserLanguagesDto);
  }

  @Get()
  @ApiOkResponse({
    type: InfinityPaginationResponse(MerchandiserLanguages),
  })
  async findAll(
    @Query() query: FindAllMerchandiserLanguagesDto,
  ): Promise<InfinityPaginationResponseDto<MerchandiserLanguages>> {
    const page = query?.page ?? 1;
    let limit = query?.limit ?? 10;
    if (limit > 50) {
      limit = 50;
    }

    const { data } = await this.merchandiserLanguagesService.findAllWithPagination({
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
    type: MerchandiserLanguages,
  })
  findById(@Param('id') id: number) {
    return this.merchandiserLanguagesService.findById(id);
  }

  @Get('merchandiser/:merchandiserId')
  @ApiParam({
    name: 'merchandiserId',
    type: Number,
    required: true,
  })
  @ApiOkResponse({
    type: [MerchandiserLanguages],
  })
  findByMerchandiserId(@Param('merchandiserId') merchandiserId: number) {
    return this.merchandiserLanguagesService.findByMerchandiserId(merchandiserId);
  }

  @Patch(':id')
  @ApiParam({
    name: 'id',
    type: Number,
    required: true,
  })
  @ApiOkResponse({
    type: MerchandiserLanguages,
  })
  update(@Param('id') id: number, @Body() updateMerchandiserLanguagesDto: UpdateMerchandiserLanguagesDto) {
    return this.merchandiserLanguagesService.update(id, updateMerchandiserLanguagesDto);
  }

  @Delete(':id')
  @ApiParam({
    name: 'id',
    type: Number,
    required: true,
  })
  remove(@Param('id') id: number) {
    return this.merchandiserLanguagesService.remove(id);
  }
}