import { Module } from '@nestjs/common';
import { UploadedPhotosService } from './uploaded-photos.service';
import { UploadedPhotosController } from './uploaded-photos.controller';
import { RelationalUploadedPhotoPersistenceModule } from './infrastructure/persistence/relational/relational-persistence.module';
import { PhotoModule } from '../photo/photo.module';
import { FilesModule } from '../files/files.module';
import { ReportModule } from '../report/report.module';

@Module({
  imports: [
    RelationalUploadedPhotoPersistenceModule,
    PhotoModule,
    FilesModule,
    ReportModule
  ],
  controllers: [UploadedPhotosController],
  providers: [UploadedPhotosService],
  exports: [UploadedPhotosService, RelationalUploadedPhotoPersistenceModule],
})
export class UploadedPhotosModule {}
