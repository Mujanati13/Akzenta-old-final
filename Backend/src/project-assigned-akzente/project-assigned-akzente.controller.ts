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
import { ProjectAssignedAkzenteService } from './project-assigned-akzente.service';
import { CreateProjectAssignedAkzenteDto } from './dto/create-project-assigned-akzente.dto';
import { UpdateProjectAssignedAkzenteDto } from './dto/update-project-assigned-akzente.dto';
import { ProjectAssignedAkzente } from './domain/project-assigned-akzente';
import { infinityPagination } from '../utils/infinity-pagination';
import { NullableType } from '../utils/types/nullable.type';
import { InfinityPaginationResponseDto } from '../utils/dto/infinity-pagination-response.dto';

@ApiTags('ProjectAssignedAkzente')
@ApiBearerAuth()
@UseGuards(AuthGuard('jwt'))
@Controller({
  path: 'project-assigned-akzente',
  version: '1',
})
export class ProjectAssignedAkzenteController {
  constructor(private readonly projectAssignedAkzenteService: ProjectAssignedAkzenteService) {}

  @Post()
  @HttpCode(HttpStatus.CREATED)
  create(@Body() createProjectAssignedAkzenteDto: CreateProjectAssignedAkzenteDto): Promise<ProjectAssignedAkzente> {
    return this.projectAssignedAkzenteService.create(createProjectAssignedAkzenteDto);
  }

  @Get()
  @HttpCode(HttpStatus.OK)
  async findAll(
    @Query('page', new DefaultValuePipe(1), ParseIntPipe) page: number,
    @Query('limit', new DefaultValuePipe(10), ParseIntPipe) limit: number,
  ): Promise<InfinityPaginationResponseDto<ProjectAssignedAkzente>> {
    if (limit > 50) {
      limit = 50;
    }

    const result = await this.projectAssignedAkzenteService.findAllWithPagination({
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
  findById(@Param('id') id: string): Promise<NullableType<ProjectAssignedAkzente>> {
    return this.projectAssignedAkzenteService.findById(+id);
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
    @Body() updateProjectAssignedAkzenteDto: UpdateProjectAssignedAkzenteDto,
  ): Promise<ProjectAssignedAkzente | null> {
    return this.projectAssignedAkzenteService.update(+id, updateProjectAssignedAkzenteDto);
  }

  @Delete(':id')
  @ApiParam({
    name: 'id',
    type: String,
    required: true,
  })
  @HttpCode(HttpStatus.NO_CONTENT)
  remove(@Param('id') id: string): Promise<void> {
    return this.projectAssignedAkzenteService.remove(+id);
  }
}