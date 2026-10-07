import { Module } from '@nestjs/common';
import { PhotoRepository } from '../photo.repository';
import { PhotoRelationalRepository } from './repositories/photo.repository';
import { TypeOrmModule } from '@nestjs/typeorm';
import { PhotoEntity } from './entities/photo.entity';

@Module({
  imports: [TypeOrmModule.forFeature([PhotoEntity])],
  providers: [
    {
      provide: PhotoRepository,
      useClass: PhotoRelationalRepository,
    },
  ],
  exports: [PhotoRepository],
})
export class RelationalPhotoPersistenceModule {}
