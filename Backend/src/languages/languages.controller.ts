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
import { LanguagesService } from './languages.service';
import { CreateLanguagesDto } from './dto/create-languages.dto';
import { UpdateLanguagesDto } from './dto/update-languages.dto';
import { FindAllLanguagesDto } from './dto/find-all-languages.dto';
import {
  ApiBearerAuth,
  ApiCreatedResponse,
  ApiOkResponse,
  ApiParam,
  ApiTags,
} from '@nestjs/swagger';
import { Languages } from './domain/languages';
import { AuthGuard } from '@nestjs/passport';
import { infinityPagination } from '../utils/infinity-pagination';
import {
  InfinityPaginationResponse,
  InfinityPaginationResponseDto,
} from '../utils/dto/infinity-pagination-response.dto';

@ApiTags('Languages')
@ApiBearerAuth()
@UseGuards(AuthGuard('jwt'))
@Controller({
  path: 'languages',
  version: '1',
})
export class LanguagesController {
  constructor(private readonly languagesService: LanguagesService) {}

  @Post()
  @ApiCreatedResponse({
    type: Languages,
  })
  create(@Body() createLanguagesDto: CreateLanguagesDto) {
    return this.languagesService.create(createLanguagesDto);
  }

  @Get()
  @ApiOkResponse({
    type: InfinityPaginationResponse(Languages),
  })
  async findAll(
    @Query() query: FindAllLanguagesDto,
  ): Promise<InfinityPaginationResponseDto<Languages>> {
    const page = query?.page ?? 1;
    let limit = query?.limit ?? 10;
    if (limit > 50) {
      limit = 50;
    }

    const { data } = await this.languagesService.findAllWithPagination({
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
    type: Languages,
  })
  findById(@Param('id') id: number) {
    return this.languagesService.findById(id);
  }

  @Patch(':id')
  @ApiParam({
    name: 'id',
    type: Number,
    required: true,
  })
  @ApiOkResponse({
    type: Languages,
  })
  update(@Param('id') id: number, @Body() updateLanguagesDto: UpdateLanguagesDto) {
    return this.languagesService.update(id, updateLanguagesDto);
  }

  @Delete(':id')
  @ApiParam({
    name: 'id',
    type: Number,
    required: true,
  })
  remove(@Param('id') id: number) {
    return this.languagesService.remove(id);
  }
}