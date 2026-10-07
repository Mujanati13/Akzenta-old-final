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
  Request,
  UseInterceptors,
  UploadedFiles,
  UseFilters,
} from '@nestjs/common';
import { MerchandiserFilesService } from './merchandiser-files.service';
import { CreateMerchandiserFilesDto } from './dto/create-merchandiser-files.dto';
import { UpdateMerchandiserFilesDto } from './dto/update-merchandiser-files.dto';
import { FindAllMerchandiserFilesDto } from './dto/find-all-merchandiser-files.dto';
import {
  ApiBearerAuth,
  ApiCreatedResponse,
  ApiOkResponse,
  ApiParam,
  ApiTags,
  ApiConsumes,
  ApiBody,
} from '@nestjs/swagger';
import { MerchandiserFiles, MerchandiserFileType } from './domain/merchandiser-files';
import { AuthGuard } from '@nestjs/passport';
import { infinityPagination } from '../utils/infinity-pagination';
import {
  InfinityPaginationResponse,
  InfinityPaginationResponseDto,
} from '../utils/dto/infinity-pagination-response.dto';
import { FileFieldsInterceptor } from '@nestjs/platform-express';
import { RolesGuard } from '../roles/roles.guard';
import { Roles } from '../roles/roles.decorator';
import { RoleEnum } from '../roles/roles.enum';
import { MulterMerchandiserFilesExceptionFilter } from './multer-merchandiser-files.exception-filter';

@ApiTags('MerchandiserFiles')
@ApiBearerAuth()
@Roles(RoleEnum.admin, RoleEnum.user)
@UseGuards(RolesGuard)
@Controller({
  path: 'merchandiser-files',
  version: '1',
})
export class MerchandiserFilesController {
  constructor(private readonly merchandiserFilesService: MerchandiserFilesService) {}

  @Post()
  @ApiCreatedResponse({
    type: MerchandiserFiles,
  })
  create(@Body() createMerchandiserFilesDto: CreateMerchandiserFilesDto) {
    return this.merchandiserFilesService.create(createMerchandiserFilesDto);
  }

  @Post('upload')
  @UseFilters(MulterMerchandiserFilesExceptionFilter)
  @ApiCreatedResponse({
    type: [MerchandiserFiles],
  })
  @ApiConsumes('multipart/form-data')
  @ApiBody({
    schema: {
      type: 'object',
      properties: {
        portrait: { 
          type: 'string', 
          format: 'binary',
          description: 'Portrait image file'
        },
        full_body_shot: { 
          type: 'string', 
          format: 'binary',
          description: 'Full body shot image file'
        },
        resume: { 
          type: 'string', 
          format: 'binary',
          description: 'Resume/CV file'
        },
        additional_attachments: {
          type: 'array',
          items: { 
            type: 'string', 
            format: 'binary' 
          },
          description: 'Additional attachment files'
        },
      },
    },
  })
  @UseInterceptors(
    FileFieldsInterceptor([
      { name: 'portrait', maxCount: 1 },
      { name: 'full_body_shot', maxCount: 1 },
      { name: 'resume', maxCount: 1 },
      { name: 'additional_attachments', maxCount: 5 },
    ]),
  )
  async uploadFiles(
    @Request() request: any,
    @UploadedFiles()
    files: {
      portrait?: Express.Multer.File[];
      full_body_shot?: Express.Multer.File[];
      resume?: Express.Multer.File[];
      additional_attachments?: Express.Multer.File[];
    },
  ): Promise<MerchandiserFiles[]> {
    return this.merchandiserFilesService.uploadFiles(request.user, files);
  }

  @Get()
  @ApiOkResponse({
    type: InfinityPaginationResponse(MerchandiserFiles),
  })
  async findAll(
    @Query() query: FindAllMerchandiserFilesDto,
  ): Promise<InfinityPaginationResponseDto<MerchandiserFiles>> {
    const page = query?.page ?? 1;
    let limit = query?.limit ?? 10;
    if (limit > 50) {
      limit = 50;
    }

    const { data } = await this.merchandiserFilesService.findAllWithPagination({
      paginationOptions: {
        page,
        limit,
      },
    });

    return infinityPagination(data, { page, limit });
  }

  @Get('me')
  @ApiOkResponse({
    type: [MerchandiserFiles],
  })
  async findMyFiles(@Request() request: any): Promise<MerchandiserFiles[]> {
    return this.merchandiserFilesService.findByCurrentUser(request.user);
  }

  @Get(':id')
  @ApiParam({
    name: 'id',
    type: Number,
    required: true,
  })
  @ApiOkResponse({
    type: MerchandiserFiles,
  })
  findById(@Param('id') id: number) {
    return this.merchandiserFilesService.findById(id);
  }

  @Get('merchandiser/:merchandiserId')
  @ApiParam({
    name: 'merchandiserId',
    type: Number,
    required: true,
  })
  @ApiOkResponse({
    type: [MerchandiserFiles],
  })
  findByMerchandiserId(@Param('merchandiserId') merchandiserId: number) {
    return this.merchandiserFilesService.findByMerchandiserId(merchandiserId);
  }

  @Get('merchandiser/:merchandiserId/type/:type')
  @ApiParam({
    name: 'merchandiserId',
    type: Number,
    required: true,
  })
  @ApiParam({
    name: 'type',
    enum: MerchandiserFileType,
    required: true,
  })
  @ApiOkResponse({
    type: [MerchandiserFiles],
  })
  findByMerchandiserIdAndType(
    @Param('merchandiserId') merchandiserId: number,
    @Param('type') type: MerchandiserFileType,
  ) {
    return this.merchandiserFilesService.findByMerchandiserIdAndType(merchandiserId, type);
  }

  @Patch(':id')
  @ApiParam({
    name: 'id',
    type: Number,
    required: true,
  })
  @ApiOkResponse({
    type: MerchandiserFiles,
  })
  update(@Param('id') id: number, @Body() updateMerchandiserFilesDto: UpdateMerchandiserFilesDto) {
    return this.merchandiserFilesService.update(id, updateMerchandiserFilesDto);
  }

  @Delete(':id')
  @ApiParam({
    name: 'id',
    type: Number,
    required: true,
  })
  remove(@Param('id') id: number) {
    return this.merchandiserFilesService.remove(id);
  }

  @Delete('me/:fileId')
  @ApiParam({
    name: 'fileId',
    type: Number,
    required: true,
  })
  @ApiOkResponse({
    description: 'File deleted successfully',
  })
  async deleteMyFile(
    @Request() request: any,
    @Param('fileId') fileId: number
  ): Promise<{ success: boolean; message: string }> {
    return this.merchandiserFilesService.deleteCurrentUserFile(request.user, fileId);
  }
}