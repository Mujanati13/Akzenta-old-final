import { Module } from '@nestjs/common';
import { MerchandiserRepository } from '../merchandiser.repository';
import { MerchandiserRelationalRepository } from './repositories/merchandiser.repository';
import { TypeOrmModule } from '@nestjs/typeorm';
import { MerchandiserEntity } from './entities/merchandiser.entity';
import { JobTypesEntity } from '../../../../job-types/infrastructure/persistence/relational/entities/job-types.entity';
import { MerchandiserJobTypesEntity } from '../../../../merchandiser-job-types/infrastructure/persistence/relational/entities/merchandiser-job-types.entity';

@Module({
  imports: [TypeOrmModule.forFeature([MerchandiserEntity, JobTypesEntity, MerchandiserJobTypesEntity])],
  providers: [
    {
      provide: MerchandiserRepository,
      useClass: MerchandiserRelationalRepository,
    },
  ],
  exports: [MerchandiserRepository],
})
export class RelationalMerchandiserPersistenceModule {}
