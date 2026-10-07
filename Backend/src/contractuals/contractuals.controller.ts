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
import { ContractualsService } from './contractuals.service';
import { CreateContractualsDto } from './dto/create-contractuals.dto';
import { UpdateContractualsDto } from './dto/update-contractuals.dto';
import { FindAllContractualsDto } from './dto/find-all-contractuals.dto';
import {
  ApiBearerAuth,
  ApiCreatedResponse,
  ApiOkResponse,
  ApiParam,
  ApiTags,
} from '@nestjs/swagger';
import { Contractuals } from './domain/contractuals';
import { AuthGuard } from '@nestjs/passport';
import { infinityPagination } from '../utils/infinity-pagination';
import {
  InfinityPaginationResponse,
  InfinityPaginationResponseDto,
} from '../utils/dto/infinity-pagination-response.dto';

@ApiTags('Contractuals')
@ApiBearerAuth()
@UseGuards(AuthGuard('jwt'))
@Controller({
  path: 'contractuals',
  version: '1',
})
export class ContractualsController {
  constructor(private readonly contractualsService: ContractualsService) {}

  @Post()
  @ApiCreatedResponse({
    type: Contractuals,
  })
  create(@Body() createContractualsDto: CreateContractualsDto) {
    return this.contractualsService.create(createContractualsDto);
  }

  @Get()
  @ApiOkResponse({
    type: InfinityPaginationResponse(Contractuals),
  })
  async findAll(
    @Query() query: FindAllContractualsDto,
  ): Promise<InfinityPaginationResponseDto<Contractuals>> {
    const page = query?.page ?? 1;
    let limit = query?.limit ?? 10;
    if (limit > 50) {
      limit = 50;
    }

    const { data } = await this.contractualsService.findAllWithPagination({
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
    type: Contractuals,
  })
  findById(@Param('id') id: number) {
    return this.contractualsService.findById(id);
  }

  @Patch(':id')
  @ApiParam({
    name: 'id',
    type: Number,
    required: true,
  })
  @ApiOkResponse({
    type: Contractuals,
  })
  update(@Param('id') id: number, @Body() updateContractualsDto: UpdateContractualsDto) {
    return this.contractualsService.update(id, updateContractualsDto);
  }

  @Delete(':id')
  @ApiParam({
    name: 'id',
    type: Number,
    required: true,
  })
  remove(@Param('id') id: number) {
    return this.contractualsService.remove(id);
  }
}