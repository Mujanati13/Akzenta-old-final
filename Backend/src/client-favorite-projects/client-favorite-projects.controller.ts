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
import { ClientFavoriteProjectService } from './client-favorite-projects.service';
import { CreateClientFavoriteProjectDto } from './dto/create-client-favorite-project.dto';
import { UpdateClientFavoriteProjectDto } from './dto/update-client-favorite-project.dto';
import {
  ApiBearerAuth,
  ApiCreatedResponse,
  ApiOkResponse,
  ApiParam,
  ApiTags,
} from '@nestjs/swagger';
import { ClientFavoriteProject } from './domain/client-favorite-project';
import { AuthGuard } from '@nestjs/passport';
import {
  InfinityPaginationResponse,
  InfinityPaginationResponseDto,
} from '../utils/dto/infinity-pagination-response.dto';
import { infinityPagination } from '../utils/infinity-pagination';
import { FindAllClientFavoriteProjectsDto } from './dto/find-all-client-favorite-project.dto';

@ApiTags('ClientFavoriteProjects')
@ApiBearerAuth()
@UseGuards(AuthGuard('jwt'))
@Controller({
  path: 'favorite-projects',
  version: '1',
})
export class ClientFavoriteProjectController {
  constructor(
    private readonly clientFavoriteProjectService: ClientFavoriteProjectService,
  ) {}

  @Post()
  @ApiCreatedResponse({
    type: ClientFavoriteProject,
  })
  create(@Body() createClientFavoriteProjectDto: CreateClientFavoriteProjectDto) {
    return this.clientFavoriteProjectService.create(createClientFavoriteProjectDto);
  }

  @Get()
  @ApiOkResponse({
    type: InfinityPaginationResponse(ClientFavoriteProject),
  })
  async findAll(
    @Query() query: FindAllClientFavoriteProjectsDto,
  ): Promise<InfinityPaginationResponseDto<ClientFavoriteProject>> {
    const page = query?.page ?? 1;
    let limit = query?.limit ?? 10;
    if (limit > 50) {
      limit = 50;
    }

    return infinityPagination(
      await this.clientFavoriteProjectService.findAllWithPagination({
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
    type: ClientFavoriteProject,
  })
  findById(@Param('id') id: string) {
    return this.clientFavoriteProjectService.findById(+id);
  }

  @Patch(':id')
  @ApiParam({
    name: 'id',
    type: String,
    required: true,
  })
  @ApiOkResponse({
    type: ClientFavoriteProject,
  })
  update(
    @Param('id') id: string,
    @Body() updateClientFavoriteProjectDto: UpdateClientFavoriteProjectDto,
  ) {
    return this.clientFavoriteProjectService.update(+id, updateClientFavoriteProjectDto);
  }

  @Delete(':id')
  @ApiParam({
    name: 'id',
    type: String,
    required: true,
  })
  remove(@Param('id') id: string) {
    return this.clientFavoriteProjectService.remove(+id);
  }
}
