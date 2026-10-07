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
  Request,
} from '@nestjs/common';
import { ApiTags, ApiCreatedResponse, ApiOkResponse } from '@nestjs/swagger';
import { SupportMailService } from './support-mail.service';
import { CreateSupportMailDto } from './dto/create-support-mail.dto';
import { UpdateSupportMailDto } from './dto/update-support-mail.dto';
import { SupportMail } from './domain/support-mail';
import { FindAllSupportMailDto } from './dto/find-all-support-mail.dto';

@ApiTags('SupportMails')
@Controller({
  path: 'support-mails',
  version: '1',
})
export class SupportMailController {
  constructor(private readonly supportMailService: SupportMailService) {}

  @Post()
  @ApiCreatedResponse({
    type: SupportMail,
  })
  async create(@Body() createSupportMailDto: CreateSupportMailDto) {    
    return this.supportMailService.create(createSupportMailDto);
  }

  @Get()
  @ApiOkResponse({
    type: FindAllSupportMailDto,
  })
  @HttpCode(HttpStatus.OK)
  async findAll(@Query('page') page = 1, @Query('limit') limit = 10) {
    const data = await this.supportMailService.findAllWithPagination({
      paginationOptions: {
        page,
        limit,
      },
    });

    return { data };
  }

  @Get('client/:clientId')
  @ApiOkResponse({
    type: FindAllSupportMailDto,
  })
  async findByClientId(@Param('clientId') clientId: number) {
    const data = await this.supportMailService.findByClientId(clientId);
    return { data };
  }

  @Get(':id')
  @ApiOkResponse({
    type: SupportMail,
  })
  findById(@Param('id') id: number) {
    return this.supportMailService.findById(id);
  }

  @Patch(':id')
  @ApiOkResponse({
    type: SupportMail,
  })
  update(@Param('id') id: number, @Body() updateSupportMailDto: UpdateSupportMailDto) {
    return this.supportMailService.update(id, updateSupportMailDto);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  remove(@Param('id') id: number) {
    return this.supportMailService.remove(id);
  }
}

