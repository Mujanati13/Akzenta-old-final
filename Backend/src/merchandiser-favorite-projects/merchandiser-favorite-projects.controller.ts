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
import { MerchandiserFavoriteProjectService } from './merchandiser-favorite-projects.service';
import { CreateMerchandiserFavoriteProjectDto } from './dto/create-merchandiser-favorite-project.dto';
import { UpdateMerchandiserFavoriteProjectDto } from './dto/update-merchandiser-favorite-project.dto';
import {
  ApiBearerAuth,
  ApiCreatedResponse,
  ApiOkResponse,
  ApiParam,
  ApiTags,
} from '@nestjs/swagger';
import { MerchandiserFavoriteProject } from './domain/merchandiser-favorite-project';
import { AuthGuard } from '@nestjs/passport';
import { infinityPagination } from '../utils/infinity-pagination';
import {
  InfinityPaginationResponse,
  InfinityPaginationResponseDto,
} from '../utils/dto/infinity-pagination-response.dto';
import { FindAllMerchandiserFavoriteProjectsDto } from './dto/find-all-merchandiser-favorite-project.dto';

@ApiTags('MerchandiserFavoriteProjects')
@ApiBearerAuth()
@UseGuards(AuthGuard('jwt'))
@Controller({
  path: 'merchandiser-favorite-projects',
  version: '1',
})
export class MerchandiserFavoriteProjectController {
  constructor(
    private readonly merchandiserFavoriteProjectService: MerchandiserFavoriteProjectService,
  ) {}

  @Post()
  @ApiCreatedResponse({
    type: MerchandiserFavoriteProject,
  })
  create(@Body() createMerchandiserFavoriteProjectDto: CreateMerchandiserFavoriteProjectDto) {
    return this.merchandiserFavoriteProjectService.create(createMerchandiserFavoriteProjectDto);
  }

  @Get()
  @ApiOkResponse({
    type: InfinityPaginationResponse(MerchandiserFavoriteProject),
  })
  async findAll(
    @Query() query: FindAllMerchandiserFavoriteProjectsDto,
  ): Promise<InfinityPaginationResponseDto<MerchandiserFavoriteProject>> {
    const page = query?.page ?? 1;
    let limit = query?.limit ?? 10;
    if (limit > 50) {
      limit = 50;
    }

    return infinityPagination(
      await this.merchandiserFavoriteProjectService.findAllWithPagination({
        paginationOptions: {
          page,
          limit,
        },
      }),
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
    type: MerchandiserFavoriteProject,
  })
  findById(@Param('id') id: string) {
    return this.merchandiserFavoriteProjectService.findById(+id);
  }

  @Patch(':id')
  @ApiParam({
    name: 'id',
    type: String,
    required: true,
  })
  @ApiOkResponse({
    type: MerchandiserFavoriteProject,
  })
  update(
    @Param('id') id: string,
    @Body() updateMerchandiserFavoriteProjectDto: UpdateMerchandiserFavoriteProjectDto,
  ) {
    return this.merchandiserFavoriteProjectService.update(+id, updateMerchandiserFavoriteProjectDto);
  }

  @Delete(':id')
  @ApiParam({
    name: 'id',
    type: String,
    required: true,
  })
  remove(@Param('id') id: string) {
    return this.merchandiserFavoriteProjectService.remove(+id);
  }
}
