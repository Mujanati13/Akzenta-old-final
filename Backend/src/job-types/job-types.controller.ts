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
import { JobTypesService } from './job-types.service';
import { CreateJobTypesDto } from './dto/create-job-types.dto';
import { UpdateJobTypesDto } from './dto/update-job-types.dto';
import { FindAllJobTypesDto } from './dto/find-all-job-types.dto';
import {
  ApiBearerAuth,
  ApiCreatedResponse,
  ApiOkResponse,
  ApiParam,
  ApiTags,
} from '@nestjs/swagger';
import { JobTypes } from './domain/job-types';
import { AuthGuard } from '@nestjs/passport';
import { infinityPagination } from '../utils/infinity-pagination';
import {
  InfinityPaginationResponse,
  InfinityPaginationResponseDto,
} from '../utils/dto/infinity-pagination-response.dto';

@ApiTags('JobTypes')
@ApiBearerAuth()
@UseGuards(AuthGuard('jwt'))
@Controller({
  path: 'job-types',
  version: '1',
})
export class JobTypesController {
  constructor(private readonly jobTypesService: JobTypesService) {}

  @Post()
  @ApiCreatedResponse({
    type: JobTypes,
  })
  create(@Body() createJobTypesDto: CreateJobTypesDto) {
    return this.jobTypesService.create(createJobTypesDto);
  }

  @Get()
  @ApiOkResponse({
    type: InfinityPaginationResponse(JobTypes),
  })
  async findAll(
    @Query() query: FindAllJobTypesDto,
  ): Promise<InfinityPaginationResponseDto<JobTypes>> {
    const page = query?.page ?? 1;
    let limit = query?.limit ?? 10;
    if (limit > 50) {
      limit = 50;
    }

    const { data } = await this.jobTypesService.findAllWithPagination({
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
    type: JobTypes,
  })
  findById(@Param('id') id: number) {
    return this.jobTypesService.findById(id);
  }

  @Patch(':id')
  @ApiParam({
    name: 'id',
    type: Number,
    required: true,
  })
  @ApiOkResponse({
    type: JobTypes,
  })
  update(@Param('id') id: number, @Body() updateJobTypesDto: UpdateJobTypesDto) {
    return this.jobTypesService.update(id, updateJobTypesDto);
  }

  @Delete(':id')
  @ApiParam({
    name: 'id',
    type: Number,
    required: true,
  })
  remove(@Param('id') id: number) {
    return this.jobTypesService.remove(id);
  }
}