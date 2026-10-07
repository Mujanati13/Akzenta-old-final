import { Module } from '@nestjs/common';
import { ContractualsService } from './contractuals.service';
import { ContractualsController } from './contractuals.controller';
import { RelationalContractualsPersistenceModule } from './infrastructure/persistence/relational/relational-persistence.module';

@Module({
  imports: [RelationalContractualsPersistenceModule],
  controllers: [ContractualsController],
  providers: [ContractualsService],
  exports: [ContractualsService, RelationalContractualsPersistenceModule],
})
export class ContractualsModule {}