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
  ApiExtraModels,
} from '@nestjs/swagger';
import { AuthGuard } from '@nestjs/passport';
import { StatusService } from './status.service';
import { CreateReportStatusDto } from './dto/create-status.dto';
import { UpdateReportStatusDto } from './dto/update-status.dto';
import { ReportStatus } from './domain/status';
import { FindAllStatusDto } from './dto/find-all-status.dto';
import {
  InfinityPaginationResponse,
  InfinityPaginationResponseDto,
} from '../utils/dto/infinity-pagination-response.dto';
import { infinityPagination } from '../utils/infinity-pagination';

// User-specific status response type
type UserSpecificStatus = {
  id: number;
  akzenteName?: string;
  clientName?: string;
  merchandiserName?: string;
  akzenteColor?: string | null;
  clientColor?: string | null;
  merchandiserColor?: string | null;
};

@ApiTags('Report Status')
@ApiBearerAuth()
@ApiExtraModels(ReportStatus, CreateReportStatusDto, UpdateReportStatusDto)
@UseGuards(AuthGuard('jwt'))
@Controller({
  path: 'status',
  version: '1',
})
export class StatusController {
  constructor(private readonly statusService: StatusService) {}

  @Post()
  @ApiCreatedResponse({
    type: ReportStatus,
  })
  create(@Body() createStatusDto: CreateReportStatusDto) {
    return this.statusService.create(createStatusDto);
  }

  @Get()
  @ApiOkResponse({
    type: InfinityPaginationResponse(ReportStatus),
  })
  async findAll(
    @Query() query: FindAllStatusDto,
  ): Promise<InfinityPaginationResponseDto<ReportStatus>> {
    const page = query?.page ?? 1;
    let limit = query?.limit ?? 10;
    if (limit > 50) {
      limit = 50;
    }

    const { data } = await this.statusService.findAllWithPagination({
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
    type: ReportStatus,
  })
  findById(@Param('id') id: number) {
    return this.statusService.findById(id);
  }

  @Patch(':id')
  @ApiParam({
    name: 'id',
    type: Number,
    required: true,
  })
  @ApiOkResponse({
    type: ReportStatus,
  })
  update(@Param('id') id: number, @Body() updateStatusDto: UpdateReportStatusDto) {
    return this.statusService.update(id, updateStatusDto);
  }

  @Delete(':id')
  @ApiParam({
    name: 'id',
    type: Number,
    required: true,
  })
  remove(@Param('id') id: number) {
    return this.statusService.remove(id);
  }

  @Get('user-type/:userType')
  @ApiParam({
    name: 'userType',
    type: String,
    required: true,
    enum: ['akzente', 'client', 'merchandiser'],
  })
  @ApiOkResponse({
    type: InfinityPaginationResponse(ReportStatus),
  })
  async findAllForUserType(
    @Param('userType') userType: 'akzente' | 'client' | 'merchandiser',
  ): Promise<InfinityPaginationResponseDto<UserSpecificStatus>> {
    const result = await this.statusService.findAllWithUserTypeNames(userType);
    
    return infinityPagination(result.data, { page: 1, limit: result.totalCount });
  }

  @Get('user-type/:userType/:id')
  @ApiParam({
    name: 'userType',
    type: String,
    required: true,
    enum: ['akzente', 'client', 'merchandiser'],
  })
  @ApiParam({
    name: 'id',
    type: Number,
    required: true,
  })
  @ApiOkResponse({
    type: ReportStatus,
  })
  async findByIdForUserType(
    @Param('userType') userType: 'akzente' | 'client' | 'merchandiser',
    @Param('id') id: number,
  ): Promise<UserSpecificStatus> {
    const status = await this.statusService.findById(id);
    if (!status) {
      throw new Error('Status not found');
    }
    
    const userSpecificName = this.statusService.getStatusNameForUserType(status, userType);
    const userSpecificColor = this.statusService.getStatusColorForUserType(status, userType);
    
    return {
      id: status.id,
      akzenteName: userType === 'akzente' ? userSpecificName : undefined,
      clientName: userType === 'client' ? userSpecificName : undefined,
      merchandiserName: userType === 'merchandiser' ? userSpecificName : undefined,
      akzenteColor: userType === 'akzente' ? userSpecificColor : undefined,
      clientColor: userType === 'client' ? userSpecificColor : undefined,
      merchandiserColor: userType === 'merchandiser' ? userSpecificColor : undefined,
    };
  }
}
