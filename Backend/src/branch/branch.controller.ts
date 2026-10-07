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
  Request,
  Inject,
  forwardRef,
} from '@nestjs/common';
import {
  ApiTags,
  ApiCreatedResponse,
  ApiOkResponse,
  ApiParam,
  ApiBearerAuth,
} from '@nestjs/swagger';
import { AuthGuard } from '@nestjs/passport';
import { BranchService } from './branch.service';
import { CreateBranchDto } from './dto/create-branch.dto';
import { UpdateBranchDto } from './dto/update-branch.dto';
import { Branch } from './domain/branch';
import { FindAllBranchDto } from './dto/find-all-branch.dto';
import {
  InfinityPaginationResponse,
  InfinityPaginationResponseDto,
} from '../utils/dto/infinity-pagination-response.dto';
import { infinityPagination } from '../utils/infinity-pagination';
import { ReportService } from '../report/report.service';

@ApiTags('Branch')
@ApiBearerAuth()
@UseGuards(AuthGuard('jwt'))
@Controller({
  path: 'branch',
  version: '1',
})
export class BranchController {
  constructor(
    private readonly branchService: BranchService,
    @Inject(forwardRef(() => ReportService))
    private readonly reportService: ReportService,
  ) {}

  @Post()
  @ApiCreatedResponse({
    type: Branch,
  })
  create(@Body() createBranchDto: CreateBranchDto) {
    return this.branchService.create(createBranchDto);
  }

  @Get()
  @ApiOkResponse({
    type: InfinityPaginationResponse(Branch),
  })
  async findAll(
    @Query() query: FindAllBranchDto,
  ): Promise<InfinityPaginationResponseDto<Branch>> {
    const page = query.page ?? 1;
    let limit = query.limit ?? 10;

    if (limit === 0) {
      // Explicit limit=0 returns all records (used when filters need the full dataset)
    } else if (limit > 100) {
      limit = 100;
    }

    const { data, totalCount } = await this.branchService.findAllWithPagination({
      paginationOptions: { page, limit },
    });

    return infinityPagination(data, { page, limit }, totalCount);
  }

  @Get(':id')
  @ApiParam({
    name: 'id',
    type: Number,
    required: true,
  })
  @ApiOkResponse({
    type: Branch,
  })
  findById(@Param('id') id: number) {
    return this.branchService.findById(id);
  }

  @Get(':id/reports')
  @ApiParam({
    name: 'id',
    type: Number,
    required: true,
  })
  @ApiOkResponse({
    type: [Branch],
  })
  getReportsByBranch(
    @Param('id') id: number,
    @Request() request: any,
  ) {
    const userId = request.user?.id;
    return this.reportService.findByBranchId(id, userId);
  }

  @Patch(':id')
  @ApiParam({
    name: 'id',
    type: Number,
    required: true,
  })
  @ApiOkResponse({
    type: Branch,
  })
  update(@Param('id') id: number, @Body() updateBranchDto: UpdateBranchDto) {
    return this.branchService.update(id, updateBranchDto);
  }

  @Delete(':id')
  @ApiParam({
    name: 'id',
    type: Number,
    required: true,
  })
  remove(@Param('id') id: number) {
    return this.branchService.remove(id);
  }
}
