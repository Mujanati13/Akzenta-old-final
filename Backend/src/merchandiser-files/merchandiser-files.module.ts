import { Module, forwardRef } from '@nestjs/common';
import { MerchandiserFilesService } from './merchandiser-files.service';
import { MerchandiserFilesController } from './merchandiser-files.controller';
import { RelationalMerchandiserFilesPersistenceModule } from './infrastructure/persistence/relational/relational-persistence.module';
import { MerchandiserModule } from '../merchandiser/merchandiser.module';
import { FilesModule } from '../files/files.module';
import { FilesLocalModule } from '../files/infrastructure/uploader/local/files.module';
import { MulterModule } from '@nestjs/platform-express';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { AllConfigType } from '../config/config.type';
import { diskStorage } from 'multer';
import { randomStringGenerator } from '@nestjs/common/utils/random-string-generator.util';
import { UnprocessableEntityException, HttpStatus } from '@nestjs/common';
import { MERCHANDISER_PROFILE_MAX_FILE_SIZE_BYTES } from './merchandiser-files-upload.constants';

@Module({
  imports: [
    RelationalMerchandiserFilesPersistenceModule,
    forwardRef(() => MerchandiserModule),
    FilesModule,
    FilesLocalModule,
    MulterModule.registerAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (configService: ConfigService<AllConfigType>) => {
        return {
          fileFilter: (request, file, callback) => {
            // Define allowed file types
            const allowedImageTypes = /\.(jpg|jpeg|png|gif|webp)$/i;
            const allowedDocumentTypes = /\.(pdf|doc|docx)$/i;

            // Check if the file type matches one of the allowed types
            if (
              !allowedImageTypes.test(file.originalname) &&
              !allowedDocumentTypes.test(file.originalname)
            ) {
              return callback(
                new UnprocessableEntityException({
                  status: HttpStatus.UNPROCESSABLE_ENTITY,
                  errors: {
                    file: `File type not allowed. Only images (jpg, jpeg, png, gif, webp) and documents (pdf, doc, docx) are allowed.`,
                  },
                }),
                false,
              );
            }

            // Accept the file if it's valid
            callback(null, true);
          },
          storage: diskStorage({
            destination: './uploads',
            filename: (request, file, callback) => {
              callback(
                null,
                `${randomStringGenerator()}.${file.originalname
                  .split('.')
                  .pop()
                  ?.toLowerCase()}`,
              );
            },
          }),
          limits: {
            fileSize: MERCHANDISER_PROFILE_MAX_FILE_SIZE_BYTES,
          },
        };
      },
    }),
  ],
  controllers: [MerchandiserFilesController],
  providers: [MerchandiserFilesService],
  exports: [MerchandiserFilesService, RelationalMerchandiserFilesPersistenceModule],
})
export class MerchandiserFilesModule {}