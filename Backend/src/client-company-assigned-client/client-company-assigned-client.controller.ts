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
import { ClientCompanyAssignedClientService } from './client-company-assigned-client.service';
import { CreateClientCompanyAssignedClientDto } from './dto/create-client-company-assigned-client.dto';
import { UpdateClientCompanyAssignedClientDto } from './dto/update-client-company-assigned-client.dto';
import { ClientCompanyAssignedClient } from './domain/client-company-assigned-client';
import { infinityPagination } from '../utils/infinity-pagination';
import { NullableType } from '../utils/types/nullable.type';
import { InfinityPaginationResponseDto } from '../utils/dto/infinity-pagination-response.dto';

@ApiTags('ClientCompanyAssignedClient')
@ApiBearerAuth()
@UseGuards(AuthGuard('jwt'))
@Controller({
  path: 'client-assignments',
  version: '1',
})
export class ClientCompanyAssignedClientController {
  constructor(private readonly clientCompanyAssignedClientService: ClientCompanyAssignedClientService) {}

  @Post()
  @HttpCode(HttpStatus.CREATED)
  create(@Body() createClientCompanyAssignedClientDto: CreateClientCompanyAssignedClientDto): Promise<ClientCompanyAssignedClient> {
    return this.clientCompanyAssignedClientService.create(createClientCompanyAssignedClientDto);
  }

  @Get()
  @HttpCode(HttpStatus.OK)
  async findAll(
    @Query('page', new DefaultValuePipe(1), ParseIntPipe) page: number,
    @Query('limit', new DefaultValuePipe(10), ParseIntPipe) limit: number,
  ): Promise<InfinityPaginationResponseDto<ClientCompanyAssignedClient>> {
    if (limit > 50) {
      limit = 50;
    }

    const result = await this.clientCompanyAssignedClientService.findAllWithPagination({
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
  findById(@Param('id') id: string): Promise<NullableType<ClientCompanyAssignedClient>> {
    return this.clientCompanyAssignedClientService.findById(+id);
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
    @Body() updateClientCompanyAssignedClientDto: UpdateClientCompanyAssignedClientDto,
  ): Promise<ClientCompanyAssignedClient | null> {
    return this.clientCompanyAssignedClientService.update(+id, updateClientCompanyAssignedClientDto);
  }

  @Delete(':id')
  @ApiParam({
    name: 'id',
    type: String,
    required: true,
  })
  @HttpCode(HttpStatus.NO_CONTENT)
  remove(@Param('id') id: string): Promise<void> {
    return this.clientCompanyAssignedClientService.remove(+id);
  }
}