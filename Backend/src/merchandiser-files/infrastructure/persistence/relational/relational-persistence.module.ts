import { Module } from '@nestjs/common';
import { MerchandiserFilesRepository } from '../merchandiser-files.repository';
import { MerchandiserFilesRelationalRepository } from './repositories/merchandiser-files.repository';
import { TypeOrmModule } from '@nestjs/typeorm';
import { MerchandiserFilesEntity } from './entities/merchandiser-files.entity';

@Module({
  imports: [TypeOrmModule.forFeature([MerchandiserFilesEntity])],
  providers: [
    {
      provide: MerchandiserFilesRepository,
      useClass: MerchandiserFilesRelationalRepository,
    },
  ],
  exports: [MerchandiserFilesRepository],
})
export class RelationalMerchandiserFilesPersistenceModule {}