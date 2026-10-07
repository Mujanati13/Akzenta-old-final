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
import { ClientCompanyAssignedAkzenteService } from './client-company-assigned-akzente.service';
import { CreateClientCompanyAssignedAkzenteDto } from './dto/create-client-company-assigned-akzente.dto';
import { UpdateClientCompanyAssignedAkzenteDto } from './dto/update-client-company-assigned-akzente.dto';
import { ClientCompanyAssignedAkzente } from './domain/client-company-assigned-akzente';
import { infinityPagination } from '../utils/infinity-pagination';
import { NullableType } from '../utils/types/nullable.type';
import { InfinityPaginationResponseDto } from '../utils/dto/infinity-pagination-response.dto';

@ApiTags('ClientCompanyAssignedAkzente')
@ApiBearerAuth()
@UseGuards(AuthGuard('jwt'))
@Controller({
  path: 'client-assignments',
  version: '1',
})
export class ClientCompanyAssignedAkzenteController {
  constructor(private readonly clientCompanyAssignedAkzenteService: ClientCompanyAssignedAkzenteService) {}

  @Post()
  @HttpCode(HttpStatus.CREATED)
  create(@Body() createClientCompanyAssignedAkzenteDto: CreateClientCompanyAssignedAkzenteDto): Promise<ClientCompanyAssignedAkzente> {
    return this.clientCompanyAssignedAkzenteService.create(createClientCompanyAssignedAkzenteDto);
  }

  @Get()
  @HttpCode(HttpStatus.OK)
  async findAll(
    @Query('page', new DefaultValuePipe(1), ParseIntPipe) page: number,
    @Query('limit', new DefaultValuePipe(10), ParseIntPipe) limit: number,
  ): Promise<InfinityPaginationResponseDto<ClientCompanyAssignedAkzente>> {
    if (limit > 50) {
      limit = 50;
    }

    const result = await this.clientCompanyAssignedAkzenteService.findAllWithPagination({
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
  findById(@Param('id') id: string): Promise<NullableType<ClientCompanyAssignedAkzente>> {
    return this.clientCompanyAssignedAkzenteService.findById(+id);
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
    @Body() updateClientCompanyAssignedAkzenteDto: UpdateClientCompanyAssignedAkzenteDto,
  ): Promise<ClientCompanyAssignedAkzente | null> {
    return this.clientCompanyAssignedAkzenteService.update(+id, updateClientCompanyAssignedAkzenteDto);
  }

  @Delete(':id')
  @ApiParam({
    name: 'id',
    type: String,
    required: true,
  })
  @HttpCode(HttpStatus.NO_CONTENT)
  remove(@Param('id') id: string): Promise<void> {
    return this.clientCompanyAssignedAkzenteService.remove(+id);
  }
}