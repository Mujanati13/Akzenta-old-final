import { Module, forwardRef } from '@nestjs/common';
import { AkzenteService } from './akzente.service';
import { AkzenteController } from './akzente.controller';
import { RelationalAkzentePersistenceModule } from './infrastructure/persistence/relational/relational-persistence.module';
import { UsersModule } from '../users/users.module';
import { AkzenteFavoriteClientCompaniesModule } from '../akzente-favorite-client-companies/akzente-favorite-client-companies.module';
import { AkzenteFavoriteReportsModule } from '../akzente-favorite-reports/akzente-favorite-reports.module';
import { AkzenteFavoriteProjectModule } from '../akzente-favorite-projects/akzente-favorite-project.module';
import { ReportModule } from '../report/report.module';
import { StatusModule } from '../report-status/status.module';
import { ProjectModule } from '../project/project.module';
import { ClientCompanyAssignedAkzenteModule } from 'src/client-company-assigned-akzente/client-company-assigned-akzente.module';
import { ClientCompanyModule } from '../client-company/client-company.module';
import { ProjectAssignedAkzenteModule } from '../project-assigned-akzente/project-assigned-akzente.module';

@Module({
  imports: [
    RelationalAkzentePersistenceModule, 
    forwardRef(() => UsersModule),
    forwardRef(() => AkzenteFavoriteClientCompaniesModule),
    forwardRef(() => AkzenteFavoriteReportsModule),
    forwardRef(() => AkzenteFavoriteProjectModule),
    forwardRef(() => ReportModule),
    forwardRef(() => StatusModule),
    forwardRef(() => ProjectModule),
    forwardRef(() => ClientCompanyAssignedAkzenteModule),
    forwardRef(() => ProjectAssignedAkzenteModule),
    forwardRef(() => ClientCompanyModule),
  ],
  controllers: [AkzenteController],
  providers: [AkzenteService],
  exports: [AkzenteService, RelationalAkzentePersistenceModule, ClientCompanyAssignedAkzenteModule],
})
export class AkzenteModule {}
