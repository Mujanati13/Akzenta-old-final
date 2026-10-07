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
import { MerchandiserEducationService } from './merchandiser-education.service';
import { CreateMerchandiserEducationDto } from './dto/create-merchandiser-education.dto';
import { UpdateMerchandiserEducationDto } from './dto/update-merchandiser-education.dto';
import { FindAllMerchandiserEducationDto } from './dto/find-all-merchandiser-education.dto';
import {
  ApiBearerAuth,
  ApiCreatedResponse,
  ApiOkResponse,
  ApiParam,
  ApiTags,
} from '@nestjs/swagger';
import { MerchandiserEducation } from './domain/merchandiser-education';
import { AuthGuard } from '@nestjs/passport';
import { infinityPagination } from '../utils/infinity-pagination';
import {
  InfinityPaginationResponse,
  InfinityPaginationResponseDto,
} from '../utils/dto/infinity-pagination-response.dto';

@ApiTags('MerchandiserEducation')
@ApiBearerAuth()
@UseGuards(AuthGuard('jwt'))
@Controller({
  path: 'merchandiser-education',
  version: '1',
})
export class MerchandiserEducationController {
  constructor(private readonly merchandiserEducationService: MerchandiserEducationService) {}

  @Post()
  @ApiCreatedResponse({
    type: MerchandiserEducation,
  })
  create(@Body() createMerchandiserEducationDto: CreateMerchandiserEducationDto) {
    return this.merchandiserEducationService.create(createMerchandiserEducationDto);
  }

  @Get()
  @ApiOkResponse({
    type: InfinityPaginationResponse(MerchandiserEducation),
  })
  async findAll(
    @Query() query: FindAllMerchandiserEducationDto,
  ): Promise<InfinityPaginationResponseDto<MerchandiserEducation>> {
    const page = query?.page ?? 1;
    let limit = query?.limit ?? 10;
    if (limit > 50) {
      limit = 50;
    }

    const { data } = await this.merchandiserEducationService.findAllWithPagination({
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
    type: MerchandiserEducation,
  })
  findById(@Param('id') id: number) {
    return this.merchandiserEducationService.findById(id);
  }

  @Get('merchandiser/:merchandiserId')
  @ApiParam({
    name: 'merchandiserId',
    type: Number,
    required: true,
  })
  @ApiOkResponse({
    type: [MerchandiserEducation],
  })
  findByMerchandiserId(@Param('merchandiserId') merchandiserId: number) {
    return this.merchandiserEducationService.findByMerchandiserId(merchandiserId);
  }

  @Patch(':id')
  @ApiParam({
    name: 'id',
    type: Number,
    required: true,
  })
  @ApiOkResponse({
    type: MerchandiserEducation,
  })
  update(@Param('id') id: number, @Body() updateMerchandiserEducationDto: UpdateMerchandiserEducationDto) {
    return this.merchandiserEducationService.update(id, updateMerchandiserEducationDto);
  }

  @Delete(':id')
  @ApiParam({
    name: 'id',
    type: Number,
    required: true,
  })
  remove(@Param('id') id: number) {
    return this.merchandiserEducationService.remove(id);
  }
}