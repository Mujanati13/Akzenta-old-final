import { Module } from '@nestjs/common';
import { UploadedPhotoRepository } from '../uploaded-photo.repository';
import { UploadedPhotoRelationalRepository } from './repositories/uploaded-photo.repository';
import { TypeOrmModule } from '@nestjs/typeorm';
import { UploadedPhotoEntity } from './entities/uploaded-photo.entity';

@Module({
  imports: [TypeOrmModule.forFeature([UploadedPhotoEntity])],
  providers: [
    {
      provide: UploadedPhotoRepository,
      useClass: UploadedPhotoRelationalRepository,
    },
  ],
  exports: [UploadedPhotoRepository],
})
export class RelationalUploadedPhotoPersistenceModule {}
