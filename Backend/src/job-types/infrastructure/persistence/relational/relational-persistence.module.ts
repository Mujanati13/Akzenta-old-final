import { Module } from '@nestjs/common';
import { JobTypesRepository } from '../job-types.repository';
import { JobTypesRelationalRepository } from './repositories/job-types.repository';
import { TypeOrmModule } from '@nestjs/typeorm';
import { JobTypesEntity } from './entities/job-types.entity';

@Module({
  imports: [TypeOrmModule.forFeature([JobTypesEntity])],
  providers: [
    {
      provide: JobTypesRepository,
      useClass: JobTypesRelationalRepository,
    },
  ],
  exports: [JobTypesRepository],
})
export class RelationalJobTypesPersistenceModule {}