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
import { SpecializationsService } from './specializations.service';
import { CreateSpecializationsDto } from './dto/create-specializations.dto';
import { UpdateSpecializationsDto } from './dto/update-specializations.dto';
import { FindAllSpecializationsDto } from './dto/find-all-specializations.dto';
import {
  ApiBearerAuth,
  ApiCreatedResponse,
  ApiOkResponse,
  ApiParam,
  ApiTags,
} from '@nestjs/swagger';
import { Specializations } from './domain/specializations';
import { AuthGuard } from '@nestjs/passport';
import { infinityPagination } from '../utils/infinity-pagination';
import {
  InfinityPaginationResponse,
  InfinityPaginationResponseDto,
} from '../utils/dto/infinity-pagination-response.dto';

@ApiTags('Specializations')
@ApiBearerAuth()
@UseGuards(AuthGuard('jwt'))
@Controller({
  path: 'specializations',
  version: '1',
})
export class SpecializationsController {
  constructor(private readonly specializationsService: SpecializationsService) {}

  @Post()
  @ApiCreatedResponse({
    type: Specializations,
  })
  create(@Body() createSpecializationsDto: CreateSpecializationsDto) {
    return this.specializationsService.create(createSpecializationsDto);
  }

  @Get()
  @ApiOkResponse({
    type: InfinityPaginationResponse(Specializations),
  })
  async findAll(
    @Query() query: FindAllSpecializationsDto,
  ): Promise<InfinityPaginationResponseDto<Specializations>> {
    const page = query?.page ?? 1;
    let limit = query?.limit ?? 10;
    if (limit > 50) {
      limit = 50;
    }

    const { data } = await this.specializationsService.findAllWithPagination({
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
    type: Specializations,
  })
  findById(@Param('id') id: number) {
    return this.specializationsService.findById(id);
  }

  @Get('job-type/:jobTypeId')
  @ApiParam({
    name: 'jobTypeId',
    type: Number,
    required: true,
  })
  @ApiOkResponse({
    type: [Specializations],
  })
  findByJobTypeId(@Param('jobTypeId') jobTypeId: number) {
    return this.specializationsService.findByJobTypeId(jobTypeId);
  }

  @Patch(':id')
  @ApiParam({
    name: 'id',
    type: Number,
    required: true,
  })
  @ApiOkResponse({
    type: Specializations,
  })
  update(@Param('id') id: number, @Body() updateSpecializationsDto: UpdateSpecializationsDto) {
    return this.specializationsService.update(id, updateSpecializationsDto);
  }

  @Delete(':id')
  @ApiParam({
    name: 'id',
    type: Number,
    required: true,
  })
  remove(@Param('id') id: number) {
    return this.specializationsService.remove(id);
  }
}