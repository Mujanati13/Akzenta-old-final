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
} from '@nestjs/common';
import {
  ApiTags,
  ApiCreatedResponse,
  ApiOkResponse,
  ApiParam,
  ApiBearerAuth,
} from '@nestjs/swagger';
import { AuthGuard } from '@nestjs/passport';
import { AdvancedPhotoService } from './advanced-photo.service';
import { CreateAdvancedPhotoDto } from './dto/create-advanced-photo.dto';
import { UpdateAdvancedPhotoDto } from './dto/update-advanced-photo.dto';
import { AdvancedPhoto } from './domain/advanced-photo';
import { FindAllAdvancedPhotoDto } from './dto/find-all-advanced-photo.dto';
import {
  InfinityPaginationResponse,
  InfinityPaginationResponseDto,
} from '../utils/dto/infinity-pagination-response.dto';
import { infinityPagination } from '../utils/infinity-pagination';

@ApiTags('AdvancedPhoto')
@ApiBearerAuth()
@UseGuards(AuthGuard('jwt'))
@Controller({
  path: 'advanced-photo',
  version: '1',
})
export class AdvancedPhotoController {
  constructor(private readonly advancedPhotoService: AdvancedPhotoService) {}

  @Post()
  @ApiCreatedResponse({
    type: AdvancedPhoto,
  })
  create(@Body() createAdvancedPhotoDto: CreateAdvancedPhotoDto) {
    return this.advancedPhotoService.create(createAdvancedPhotoDto);
  }

  @Get()
  @ApiOkResponse({
    type: InfinityPaginationResponse(AdvancedPhoto),
  })
  async findAll(
    @Query() query: FindAllAdvancedPhotoDto,
  ): Promise<InfinityPaginationResponseDto<AdvancedPhoto>> {
    const page = query?.page ?? 1;
    let limit = query?.limit ?? 10;
    if (limit > 50) {
      limit = 50;
    }

    const { data } = await this.advancedPhotoService.findAllWithPagination({
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
    type: AdvancedPhoto,
  })
  findById(@Param('id') id: number) {
    return this.advancedPhotoService.findById(id);
  }

  @Patch(':id')
  @ApiParam({
    name: 'id',
    type: Number,
    required: true,
  })
  @ApiOkResponse({
    type: AdvancedPhoto,
  })
  update(
    @Param('id') id: number,
    @Body() updateAdvancedPhotoDto: UpdateAdvancedPhotoDto,
  ) {
    return this.advancedPhotoService.update(id, updateAdvancedPhotoDto);
  }

  @Delete(':id')
  @ApiParam({
    name: 'id',
    type: Number,
    required: true,
  })
  remove(@Param('id') id: number) {
    return this.advancedPhotoService.remove(id);
  }
}
