import {
  Controller,
  Get,
  Post,
  Body,
  Patch,
  Param,
  Delete,
  Query,
  HttpStatus,
  HttpCode,
} from '@nestjs/common';
import { ApiTags, ApiCreatedResponse, ApiOkResponse } from '@nestjs/swagger';
import { SupportService } from './support.service';
import { CreateSupportDto } from './dto/create-support.dto';
import { UpdateSupportDto } from './dto/update-support.dto';
import { Support } from './domain/support';
import { FindAllSupportDto } from './dto/find-all-support.dto';

@ApiTags('Support')
@Controller({
  path: 'support',
  version: '1',
})
export class SupportController {
  constructor(private readonly supportService: SupportService) {}

  @Post()
  @ApiCreatedResponse({
    type: Support,
  })
  create(@Body() createSupportDto: CreateSupportDto) {
    return this.supportService.create(createSupportDto);
  }

  @Get()
  @ApiOkResponse({
    type: FindAllSupportDto,
  })
  @HttpCode(HttpStatus.OK)
  async findAll(@Query('page') page = 1, @Query('limit') limit = 10) {
    const data = await this.supportService.findAllWithPagination({
      paginationOptions: {
        page,
        limit,
      },
    });

    return { data };
  }

  @Get(':id')
  @ApiOkResponse({
    type: Support,
  })
  findById(@Param('id') id: number) {
    return this.supportService.findById(id);
  }

  @Patch(':id')
  @ApiOkResponse({
    type: Support,
  })
  update(@Param('id') id: number, @Body() updateSupportDto: UpdateSupportDto) {
    return this.supportService.update(id, updateSupportDto);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  remove(@Param('id') id: number) {
    return this.supportService.remove(id);
  }
}

