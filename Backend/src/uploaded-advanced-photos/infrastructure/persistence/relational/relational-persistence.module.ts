import { Module } from '@nestjs/common';
import { UploadedAdvancedPhotoRepository } from '../uploaded-advanced-photo.repository';
import { UploadedAdvancedPhotoRelationalRepository } from './repositories/uploaded-advanced-photo.repository';
import { TypeOrmModule } from '@nestjs/typeorm';
import { UploadedAdvancedPhotoEntity } from './entities/uploaded-advanced-photo.entity';

@Module({
  imports: [TypeOrmModule.forFeature([UploadedAdvancedPhotoEntity])],
  providers: [
    {
      provide: UploadedAdvancedPhotoRepository,
      useClass: UploadedAdvancedPhotoRelationalRepository,
    },
  ],
  exports: [UploadedAdvancedPhotoRepository],
})
export class RelationalUploadedAdvancedPhotoPersistenceModule {}
