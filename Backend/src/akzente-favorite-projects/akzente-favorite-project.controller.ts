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
import { AkzenteFavoriteProjectService } from './akzente-favorite-project.service';
import { CreateAkzenteFavoriteProjectDto } from './dto/create-akzente-favorite-project.dto';
import { UpdateAkzenteFavoriteProjectDto } from './dto/update-akzente-favorite-project.dto';
import {
  ApiBearerAuth,
  ApiCreatedResponse,
  ApiOkResponse,
  ApiParam,
  ApiTags,
} from '@nestjs/swagger';
import { AkzenteFavoriteProject } from './domain/akzente-favorite-project';
import { AuthGuard } from '@nestjs/passport';
import {
  InfinityPaginationResponse,
  InfinityPaginationResponseDto,
} from '../utils/dto/infinity-pagination-response.dto';
import { infinityPagination } from '../utils/infinity-pagination';
import { FindAllAkzenteFavoriteProjectsDto } from './dto/find-all-akzente-favorite-project.dto';

@ApiTags('AkzenteFavoriteProjects')
@ApiBearerAuth()
@UseGuards(AuthGuard('jwt'))
@Controller({
  path: 'favorite-projects',
  version: '1',
})
export class AkzenteFavoriteProjectController {
  constructor(
    private readonly akzenteFavoriteProjectService: AkzenteFavoriteProjectService,
  ) {}

  @Post()
  @ApiCreatedResponse({
    type: AkzenteFavoriteProject,
  })
  create(@Body() createAkzenteFavoriteProjectDto: CreateAkzenteFavoriteProjectDto) {
    return this.akzenteFavoriteProjectService.create(createAkzenteFavoriteProjectDto);
  }

  @Get()
  @ApiOkResponse({
    type: InfinityPaginationResponse(AkzenteFavoriteProject),
  })
  async findAll(
    @Query() query: FindAllAkzenteFavoriteProjectsDto,
  ): Promise<InfinityPaginationResponseDto<AkzenteFavoriteProject>> {
    const page = query?.page ?? 1;
    let limit = query?.limit ?? 10;
    if (limit > 50) {
      limit = 50;
    }

    return infinityPagination(
      await this.akzenteFavoriteProjectService.findAllWithPagination({
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
    type: AkzenteFavoriteProject,
  })
  findById(@Param('id') id: string) {
    return this.akzenteFavoriteProjectService.findById(+id);
  }

  @Patch(':id')
  @ApiParam({
    name: 'id',
    type: String,
    required: true,
  })
  @ApiOkResponse({
    type: AkzenteFavoriteProject,
  })
  update(
    @Param('id') id: string,
    @Body() updateAkzenteFavoriteProjectDto: UpdateAkzenteFavoriteProjectDto,
  ) {
    return this.akzenteFavoriteProjectService.update(+id, updateAkzenteFavoriteProjectDto);
  }

  @Delete(':id')
  @ApiParam({
    name: 'id',
    type: String,
    required: true,
  })
  remove(@Param('id') id: string) {
    return this.akzenteFavoriteProjectService.remove(+id);
  }
}
