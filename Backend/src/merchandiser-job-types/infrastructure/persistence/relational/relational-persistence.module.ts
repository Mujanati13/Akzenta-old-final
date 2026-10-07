import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { MerchandiserJobTypesEntity } from './entities/merchandiser-job-types.entity';
import { MerchandiserJobTypesRepository } from '../merchandiser-job-types.repository';
import { MerchandiserJobTypesRelationalRepository } from './repositories/merchandiser-job-types.repository';

@Module({
  imports: [TypeOrmModule.forFeature([MerchandiserJobTypesEntity])],
  providers: [
    {
      provide: MerchandiserJobTypesRepository,
      useClass: MerchandiserJobTypesRelationalRepository,
    },
  ],
  exports: [MerchandiserJobTypesRepository],
})
export class RelationalMerchandiserJobTypesPersistenceModule {}