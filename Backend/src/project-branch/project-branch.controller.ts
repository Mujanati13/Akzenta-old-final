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
import { ProjectBranchService } from './project-branch.service';
import { CreateProjectBranchDto } from './dto/create-project-branch.dto';
import { UpdateProjectBranchDto } from './dto/update-project-branch.dto';
import { ProjectBranch } from './domain/project-branch';
import { FindAllProjectBranchDto } from './dto/find-all-project-branch.dto';
import {
  InfinityPaginationResponse,
  InfinityPaginationResponseDto,
} from '../utils/dto/infinity-pagination-response.dto';
import { infinityPagination } from '../utils/infinity-pagination';

@ApiTags('ProjectBranch')
@ApiBearerAuth()
@UseGuards(AuthGuard('jwt'))
@Controller({
  path: 'project-branch',
  version: '1',
})
export class ProjectBranchController {
  constructor(private readonly projectBranchService: ProjectBranchService) {}

  @Post()
  @ApiCreatedResponse({
    type: ProjectBranch,
  })
  create(@Body() createProjectBranchDto: CreateProjectBranchDto) {
    return this.projectBranchService.create(createProjectBranchDto);
  }

  @Get()
  @ApiOkResponse({
    type: InfinityPaginationResponse(ProjectBranch),
  })
  async findAll(
    @Query() query: FindAllProjectBranchDto,
  ): Promise<InfinityPaginationResponseDto<ProjectBranch>> {
    const page = query?.page ?? 1;
    let limit = query?.limit ?? 10;
    if (limit > 50) {
      limit = 50;
    }

    const { data } = await this.projectBranchService.findAllWithPagination({
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
    type: ProjectBranch,
  })
  findById(@Param('id') id: number) {
    return this.projectBranchService.findById(id);
  }

  @Patch(':id')
  @ApiParam({
    name: 'id',
    type: Number,
    required: true,
  })
  @ApiOkResponse({
    type: ProjectBranch,
  })
  update(
    @Param('id') id: number,
    @Body() updateProjectBranchDto: UpdateProjectBranchDto,
  ) {
    return this.projectBranchService.update(id, updateProjectBranchDto);
  }

  @Delete(':id')
  @ApiParam({
    name: 'id',
    type: Number,
    required: true,
  })
  remove(@Param('id') id: number) {
    return this.projectBranchService.remove(id);
  }
}
