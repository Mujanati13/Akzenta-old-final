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
import { UploadedAdvancedPhotosService } from './uploaded-advanced-photos.service';
import { CreateUploadedAdvancedPhotoDto } from './dto/create-uploaded-advanced-photo.dto';
import { UpdateUploadedAdvancedPhotoDto } from './dto/update-uploaded-advanced-photo.dto';
import { UploadedAdvancedPhoto } from './domain/uploaded-advanced-photo';
import { FindAllUploadedAdvancedPhotosDto } from './dto/find-all-uploaded-advanced-photos.dto';
import {
  InfinityPaginationResponse,
  InfinityPaginationResponseDto,
} from '../utils/dto/infinity-pagination-response.dto';
import { infinityPagination } from '../utils/infinity-pagination';

@ApiTags('UploadedAdvancedPhotos')
@ApiBearerAuth()
@UseGuards(AuthGuard('jwt'))
@Controller({
  path: 'uploaded-advanced-photos',
  version: '1',
})
export class UploadedAdvancedPhotosController {
  constructor(
    private readonly uploadedAdvancedPhotosService: UploadedAdvancedPhotosService,
  ) {}

  @Post()
  @ApiCreatedResponse({
    type: UploadedAdvancedPhoto,
  })
  create(
    @Body() createUploadedAdvancedPhotoDto: CreateUploadedAdvancedPhotoDto,
  ) {
    return this.uploadedAdvancedPhotosService.create(
      createUploadedAdvancedPhotoDto,
    );
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
  //       advancedPhotoId: {
  //         type: 'number',
  //       },
  //     },
  //   },
  // })
  // @UseInterceptors(FileInterceptor('file'))
  // @ApiCreatedResponse({
  //   type: UploadedAdvancedPhoto,
  // })
  // async uploadFile(
  //   @UploadedFile() file: Express.Multer.File,
  //   @Body('advancedPhotoId') advancedPhotoId: number,
  // ): Promise<UploadedAdvancedPhoto> {
  //   return this.uploadedAdvancedPhotosService.uploadFile(file, advancedPhotoId);
  // }

  @Get()
  @ApiOkResponse({
    type: InfinityPaginationResponse(UploadedAdvancedPhoto),
  })
  async findAll(
    @Query() query: FindAllUploadedAdvancedPhotosDto,
  ): Promise<InfinityPaginationResponseDto<UploadedAdvancedPhoto>> {
    const page = query?.page ?? 1;
    let limit = query?.limit ?? 10;
    if (limit > 50) {
      limit = 50;
    }

    const { data } =
      await this.uploadedAdvancedPhotosService.findAllWithPagination({
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
    type: UploadedAdvancedPhoto,
  })
  findById(@Param('id') id: number) {
    return this.uploadedAdvancedPhotosService.findById(id);
  }

  @Patch(':id')
  @ApiParam({
    name: 'id',
    type: Number,
    required: true,
  })
  @ApiOkResponse({
    type: UploadedAdvancedPhoto,
  })
  update(
    @Param('id') id: number,
    @Body() updateUploadedAdvancedPhotoDto: UpdateUploadedAdvancedPhotoDto,
  ) {
    return this.uploadedAdvancedPhotosService.update(
      id,
      updateUploadedAdvancedPhotoDto,
    );
  }

  @Delete(':id')
  @ApiParam({
    name: 'id',
    type: Number,
    required: true,
  })
  remove(@Param('id') id: number) {
    return this.uploadedAdvancedPhotosService.remove(id);
  }
}
