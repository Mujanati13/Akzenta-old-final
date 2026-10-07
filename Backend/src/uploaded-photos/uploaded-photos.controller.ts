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
  UploadedFile,
  UseInterceptors,
} from '@nestjs/common';
import {
  ApiTags,
  ApiCreatedResponse,
  ApiOkResponse,
  ApiParam,
  ApiBearerAuth,
  ApiConsumes,
  ApiBody,
} from '@nestjs/swagger';
import { AuthGuard } from '@nestjs/passport';
import { FileInterceptor } from '@nestjs/platform-express';
import { UploadedPhotosService } from './uploaded-photos.service';
import { CreateUploadedPhotoDto } from './dto/create-uploaded-photo.dto';
import { UpdateUploadedPhotoDto } from './dto/update-uploaded-photo.dto';
import { UploadedPhoto } from './domain/uploaded-photo';
import { FindAllUploadedPhotosDto } from './dto/find-all-uploaded-photos.dto';
import {
  InfinityPaginationResponse,
  InfinityPaginationResponseDto,
} from '../utils/dto/infinity-pagination-response.dto';
import { infinityPagination } from '../utils/infinity-pagination';

@ApiTags('UploadedPhotos')
@ApiBearerAuth()
@UseGuards(AuthGuard('jwt'))
@Controller({
  path: 'uploaded-photos',
  version: '1',
})
export class UploadedPhotosController {
  constructor(private readonly uploadedPhotosService: UploadedPhotosService) {}

  @Post()
  @ApiCreatedResponse({
    type: UploadedPhoto,
  })
  create(@Body() createUploadedPhotoDto: CreateUploadedPhotoDto) {
    return this.uploadedPhotosService.create(createUploadedPhotoDto);
  }

  // @Post('upload')
  // @ApiConsumes('multipart/form-data')
  // @ApiBody({
  //   schema: {
  //     type: 'object',
  //     properties: {
  //       file: {
  //         type: 'string',
  //         format: 'binary',
  //       },
  //       photoId: {
  //         type: 'number',
  //       },
  //       typeId: {
  //         type: 'number',
  //       },
  //     },
  //   },
  // })
  // @UseInterceptors(FileInterceptor('file'))
  // @ApiCreatedResponse({
  //   type: UploadedPhoto,
  // })
  // async uploadFile(
  //   @UploadedFile() file: Express.Multer.File,
  //   @Body('photoId') photoId: number,
  //   @Body('typeId') typeId: number,
  // ): Promise<UploadedPhoto> {
  //   return this.uploadedPhotosService.uploadFile(file, photoId, typeId);
  // }

  @Get()
  @ApiOkResponse({
    type: InfinityPaginationResponse(UploadedPhoto),
  })
  async findAll(
    @Query() query: FindAllUploadedPhotosDto,
  ): Promise<InfinityPaginationResponseDto<UploadedPhoto>> {
    const page = query?.page ?? 1;
    let limit = query?.limit ?? 10;
    if (limit > 50) {
      limit = 50;
    }

    const { data } = await this.uploadedPhotosService.findAllWithPagination({
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
    type: UploadedPhoto,
  })
  findById(@Param('id') id: number) {
    return this.uploadedPhotosService.findById(id);
  }

  @Patch(':id')
  @ApiParam({
    name: 'id',
    type: Number,
    required: true,
  })
  @ApiOkResponse({
    type: UploadedPhoto,
  })
  update(
    @Param('id') id: number,
    @Body() updateUploadedPhotoDto: UpdateUploadedPhotoDto,
  ) {
    return this.uploadedPhotosService.update(id, updateUploadedPhotoDto);
  }

  @Delete(':id')
  @ApiParam({
    name: 'id',
    type: Number,
    required: true,
  })
  remove(@Param('id') id: number) {
    return this.uploadedPhotosService.remove(id);
  }
}
