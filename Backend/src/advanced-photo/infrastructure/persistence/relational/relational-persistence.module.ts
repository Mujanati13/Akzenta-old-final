import { Module } from '@nestjs/common';
import { AdvancedPhotoRepository } from '../advanced-photo.repository';
import { AdvancedPhotoRelationalRepository } from './repositories/advanced-photo.repository';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AdvancedPhotoEntity } from './entities/advanced-photo.entity';

@Module({
  imports: [TypeOrmModule.forFeature([AdvancedPhotoEntity])],
  providers: [
    {
      provide: AdvancedPhotoRepository,
      useClass: AdvancedPhotoRelationalRepository,
    },
  ],
  exports: [AdvancedPhotoRepository],
})
export class RelationalAdvancedPhotoPersistenceModule {}
