import { Module } from '@nestjs/common';
import { SpecializationsService } from './specializations.service';
import { SpecializationsController } from './specializations.controller';
import { RelationalSpecializationsPersistenceModule } from './infrastructure/persistence/relational/relational-persistence.module';
import { JobTypesModule } from '../job-types/job-types.module';

@Module({
  imports: [RelationalSpecializationsPersistenceModule, JobTypesModule],
  controllers: [SpecializationsController],
  providers: [SpecializationsService],
  exports: [SpecializationsService, RelationalSpecializationsPersistenceModule],
})
export class SpecializationsModule {}