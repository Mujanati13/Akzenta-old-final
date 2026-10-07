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
import { AkzenteFavoriteMerchandisersService } from './akzente-favorite-merchandiser.service';
import { CreateAkzenteFavoriteMerchandiserDto } from './dto/create-akzente-favorite-merchandiser.dto';
import { UpdateAkzenteFavoriteMerchandiserDto } from './dto/update-akzente-favorite-merchandiser.dto';
import {
  ApiBearerAuth,
  ApiCreatedResponse,
  ApiOkResponse,
  ApiParam,
  ApiTags,
} from '@nestjs/swagger';
import { AkzenteFavoriteMerchandiser } from './domain/akzente-favorite-merchandiser';
import { AuthGuard } from '@nestjs/passport';
import {
  InfinityPaginationResponse,
  InfinityPaginationResponseDto,
} from '../utils/dto/infinity-pagination-response.dto';
import { infinityPagination } from '../utils/infinity-pagination';
import { FindAllAkzenteFavoriteMerchandisersDto } from './dto/find-all-akzente-favorite-merchandiser.dto';

@ApiTags('AkzenteFavoriteMerchandisers')
@ApiBearerAuth()
@UseGuards(AuthGuard('jwt'))
@Controller({
  path: 'favorite-merchandisers',
  version: '1',
})
export class AkzenteFavoriteMerchandisersController {
  constructor(
    private readonly akzenteFavoriteMerchandisersService: AkzenteFavoriteMerchandisersService,
  ) {}

  @Post()
  @ApiCreatedResponse({
    type: AkzenteFavoriteMerchandiser,
  })
  create(@Body() createFavoriteMerchandiserDto: CreateAkzenteFavoriteMerchandiserDto) {
    return this.akzenteFavoriteMerchandisersService.create(createFavoriteMerchandiserDto);
  }

  @Get()
  @ApiOkResponse({
    type: InfinityPaginationResponse(AkzenteFavoriteMerchandiser),
  })
  async findAll(
    @Query() query: FindAllAkzenteFavoriteMerchandisersDto,
  ): Promise<InfinityPaginationResponseDto<AkzenteFavoriteMerchandiser>> {
    const page = query?.page ?? 1;
    let limit = query?.limit ?? 10;
    if (limit > 50) {
      limit = 50;
    }

    return infinityPagination(
      await this.akzenteFavoriteMerchandisersService.findAllWithPagination({
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
    type: AkzenteFavoriteMerchandiser,
  })
  findById(@Param('id') id: string) {
    return this.akzenteFavoriteMerchandisersService.findById(+id);
  }

  @Patch(':id')
  @ApiParam({
    name: 'id',
    type: String,
    required: true,
  })
  @ApiOkResponse({
    type: AkzenteFavoriteMerchandiser,
  })
  update(
    @Param('id') id: string,
    @Body() updateAkzenteFavoriteMerchandiserDto: UpdateAkzenteFavoriteMerchandiserDto,
  ) {
    return this.akzenteFavoriteMerchandisersService.update(+id, updateAkzenteFavoriteMerchandiserDto);
  }

  @Delete(':id')
  @ApiParam({
    name: 'id',
    type: String,
    required: true,
  })
  remove(@Param('id') id: string) {
    return this.akzenteFavoriteMerchandisersService.remove(+id);
  }
}
