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
import { AkzenteFavoriteClientsService } from './akzente-favorite-clients.service';
import { CreateAkzenteFavoriteClientDto } from './dto/create-akzente-favorite-client.dto';
import { UpdateAkzenteFavoriteClientDto } from './dto/update-akzente-favorite-client.dto';
import {
  ApiBearerAuth,
  ApiCreatedResponse,
  ApiOkResponse,
  ApiParam,
  ApiTags,
} from '@nestjs/swagger';
import { AkzenteFavoriteClient } from './domain/akzente-favorite-client';
import { AuthGuard } from '@nestjs/passport';
import {
  InfinityPaginationResponse,
  InfinityPaginationResponseDto,
} from '../utils/dto/infinity-pagination-response.dto';
import { infinityPagination } from '../utils/infinity-pagination';
import { FindAllAkzenteFavoriteClientsDto } from './dto/find-all-akzente-favorite-clients.dto';

@ApiTags('Favoriteclients')
@ApiBearerAuth()
@UseGuards(AuthGuard('jwt'))
@Controller({
  path: 'favorite-clients',
  version: '1',
})
export class AkzenteFavoriteClientsController {
  constructor(
    private readonly akzenteFavoriteClientsService: AkzenteFavoriteClientsService,
  ) {}

  @Post()
  @ApiCreatedResponse({
    type: AkzenteFavoriteClient,
  })
  create(@Body() createFavoriteClientDto: CreateAkzenteFavoriteClientDto) {
    return this.akzenteFavoriteClientsService.create(createFavoriteClientDto);
  }

  @Get()
  @ApiOkResponse({
    type: InfinityPaginationResponse(AkzenteFavoriteClient),
  })
  async findAll(
    @Query() query: FindAllAkzenteFavoriteClientsDto,
  ): Promise<InfinityPaginationResponseDto<AkzenteFavoriteClient>> {
    const page = query?.page ?? 1;
    let limit = query?.limit ?? 10;
    if (limit > 50) {
      limit = 50;
    }

    return infinityPagination(
      await this.akzenteFavoriteClientsService.findAllWithPagination({
        paginationOptions: {
          page,
          limit,
        },
      }),
      { page, limit },
    );
  }

  @Get(':id')
  @ApiParam({
    name: 'id',
    type: String,
    required: true,
  })
  @ApiOkResponse({
    type: AkzenteFavoriteClient,
  })
  findById(@Param('id') id: string) {
    return this.akzenteFavoriteClientsService.findById(+id);
  }

  @Patch(':id')
  @ApiParam({
    name: 'id',
    type: String,
    required: true,
  })
  @ApiOkResponse({
    type: AkzenteFavoriteClient,
  })
  update(
    @Param('id') id: string,
    @Body() updateFavoriteClientDto: UpdateAkzenteFavoriteClientDto,
  ) {
    return this.akzenteFavoriteClientsService.update(+id, updateFavoriteClientDto);
  }

  @Delete(':id')
  @ApiParam({
    name: 'id',
    type: String,
    required: true,
  })
  remove(@Param('id') id: string) {
    return this.akzenteFavoriteClientsService.remove(+id);
  }
}
