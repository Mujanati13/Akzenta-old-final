import { Module, forwardRef } from '@nestjs/common';
import { UploadedAdvancedPhotosService } from './uploaded-advanced-photos.service';
import { UploadedAdvancedPhotosController } from './uploaded-advanced-photos.controller';
import { RelationalUploadedAdvancedPhotoPersistenceModule } from './infrastructure/persistence/relational/relational-persistence.module';
import { AdvancedPhotoModule } from '../advanced-photo/advanced-photo.module';
import { FilesModule } from '../files/files.module';
import { ReportModule } from '../report/report.module';

@Module({
  imports: [
    RelationalUploadedAdvancedPhotoPersistenceModule,
    AdvancedPhotoModule,
    FilesModule,
    forwardRef(() => ReportModule)
  ],
  controllers: [UploadedAdvancedPhotosController],
  providers: [UploadedAdvancedPhotosService],
  exports: [
    UploadedAdvancedPhotosService,
    RelationalUploadedAdvancedPhotoPersistenceModule,
  ],
})
export class UploadedAdvancedPhotosModule {}
