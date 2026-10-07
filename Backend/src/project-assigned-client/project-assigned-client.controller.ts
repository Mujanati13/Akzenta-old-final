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
  DefaultValuePipe,
  ParseIntPipe,
  HttpStatus,
  HttpCode,
  SerializeOptions,
} from '@nestjs/common';
import { ApiBearerAuth, ApiParam, ApiTags } from '@nestjs/swagger';
import { AuthGuard } from '@nestjs/passport';
import { ProjectAssignedClientService } from './project-assigned-client.service';
import { CreateProjectAssignedClientDto } from './dto/create-project-assigned-client.dto';
import { UpdateProjectAssignedClientDto } from './dto/update-project-assigned-client.dto';
import { ProjectAssignedClient } from './domain/project-assigned-client';
import { infinityPagination } from '../utils/infinity-pagination';
import { NullableType } from '../utils/types/nullable.type';
import { InfinityPaginationResponseDto } from '../utils/dto/infinity-pagination-response.dto';

@ApiTags('ProjectAssignedClient')
@ApiBearerAuth()
@UseGuards(AuthGuard('jwt'))
@Controller({
  path: 'project-assigned-client',
  version: '1',
})
export class ProjectAssignedClientController {
  constructor(private readonly projectAssignedClientService: ProjectAssignedClientService) {}

  @Post()
  @HttpCode(HttpStatus.CREATED)
  create(@Body() createProjectAssignedClientDto: CreateProjectAssignedClientDto): Promise<ProjectAssignedClient> {
    return this.projectAssignedClientService.create(createProjectAssignedClientDto);
  }

  @Get()
  @HttpCode(HttpStatus.OK)
  async findAll(
    @Query('page', new DefaultValuePipe(1), ParseIntPipe) page: number,
    @Query('limit', new DefaultValuePipe(10), ParseIntPipe) limit: number,
  ): Promise<InfinityPaginationResponseDto<ProjectAssignedClient>> {
    if (limit > 50) {
      limit = 50;
    }

    const result = await this.projectAssignedClientService.findAllWithPagination({
      paginationOptions: {
        page,
        limit,
      },
    });

    return infinityPagination(result.data, { page, limit });
  }

  @Get(':id')
  @HttpCode(HttpStatus.OK)
  @ApiParam({
    name: 'id',
    type: String,
    required: true,
  })
  findById(@Param('id') id: string): Promise<NullableType<ProjectAssignedClient>> {
    return this.projectAssignedClientService.findById(+id);
  }

  @Patch(':id')
  @HttpCode(HttpStatus.OK)
  @ApiParam({
    name: 'id',
    type: String,
    required: true,
  })
  update(
    @Param('id') id: string,
    @Body() updateProjectAssignedClientDto: UpdateProjectAssignedClientDto,
  ): Promise<ProjectAssignedClient | null> {
    return this.projectAssignedClientService.update(+id, updateProjectAssignedClientDto);
  }

  @Delete(':id')
  @ApiParam({
    name: 'id',
    type: String,
    required: true,
  })
  @HttpCode(HttpStatus.NO_CONTENT)
  remove(@Param('id') id: string): Promise<void> {
    return this.projectAssignedClientService.remove(+id);
  }
}