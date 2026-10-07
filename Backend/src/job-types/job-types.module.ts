import { Module } from '@nestjs/common';
import { JobTypesService } from './job-types.service';
import { JobTypesController } from './job-types.controller';
import { RelationalJobTypesPersistenceModule } from './infrastructure/persistence/relational/relational-persistence.module';

@Module({
  imports: [RelationalJobTypesPersistenceModule],
  controllers: [JobTypesController],
  providers: [JobTypesService],
  exports: [JobTypesService, RelationalJobTypesPersistenceModule],
})
export class JobTypesModule {}