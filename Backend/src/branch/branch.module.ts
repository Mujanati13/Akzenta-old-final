import { Module, forwardRef } from '@nestjs/common';
import { BranchService } from './branch.service';
import { BranchController } from './branch.controller';
import { RelationalBranchPersistenceModule } from './infrastructure/persistence/relational/relational-persistence.module';
import { ClientCompanyModule } from '../client-company/client-company.module';
import { CitiesModule } from '../cities/cities.module';
import { ReportModule } from '../report/report.module';

@Module({
  imports: [RelationalBranchPersistenceModule, forwardRef(() => ClientCompanyModule), forwardRef(() => CitiesModule), forwardRef(() => ReportModule)],
  controllers: [BranchController],
  providers: [BranchService],
  exports: [BranchService, RelationalBranchPersistenceModule],
})
export class BranchModule {}
