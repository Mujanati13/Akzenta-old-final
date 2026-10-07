import {
  Controller,
  Get,
  Param,
  Post,
  Req,
  Response,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import {
  ApiBearerAuth,
  ApiBody,
  ApiConsumes,
  ApiCreatedResponse,
  ApiExcludeEndpoint,
  ApiTags,
} from '@nestjs/swagger';
import { FilesLocalService } from './files.service';
import { FileResponseDto } from './dto/file-response.dto';
import { Roles } from 'src/roles/roles.decorator';
import { RoleEnum } from 'src/roles/roles.enum';
import { RolesGuard } from 'src/roles/roles.guard';

@ApiTags('Files')
@Controller({
  path: 'uploads',
  version: '1',
})
export class FilesLocalController {
  constructor(private readonly filesService: FilesLocalService) {}

  @ApiCreatedResponse({
    type: FileResponseDto,
  })
  @ApiBearerAuth()
  @Roles(RoleEnum.admin)
  @UseGuards(RolesGuard)
  @Post('upload')
  @ApiConsumes('multipart/form-data')
  @ApiBody({
    schema: {
      type: 'object',
      properties: {
        file: {
          type: 'string',
          format: 'binary',
        },
      },
    },
  })
  @UseInterceptors(FileInterceptor('file'))
  async uploadFile(
    @UploadedFile() file: Express.Multer.File,
  ): Promise<FileResponseDto> {
    return this.filesService.create(file);
  }

  @Get('/*')
  @ApiExcludeEndpoint()
  download(@Req() req, @Response() response) {
    const path = req.originalUrl.split('/uploads/')[1];
    if (!path) {
      return response.status(404).json({
        statusCode: 404,
        message: 'File not found',
        error: 'Not Found',
      });
    }
    return response.sendFile(path, { root: './uploads' }, (err) => {
      if (err) {
        if (err.code === 'ENOENT') {
          return response.status(404).json({
            statusCode: 404,
            message: 'File not found',
            error: 'Not Found',
          });
        }
        return response.status(500).json({
          statusCode: 500,
          message: 'Error serving file',
          error: 'Internal Server Error',
        });
      }
    });
  }
}
