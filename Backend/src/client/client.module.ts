import { Module, forwardRef } from '@nestjs/common';
import { ClientService } from './client.service';
import { ClientController } from './client.controller';
import { RelationalClientPersistenceModule } from './infrastructure/persistence/relational/relational-persistence.module';
import { UsersModule } from '../users/users.module';
import { ProjectAssignedClientModule } from '../project-assigned-client/project-assigned-client.module';
import { ClientFavoriteProjectsModule } from '../client-favorite-projects/client-favorite-projects.module';
import { ClientFavoriteReportsModule } from '../client-favorite-reports/client-favorite-reports.module';
import { ReportModule } from '../report/report.module';
import { ProjectModule } from '../project/project.module';

@Module({
  imports: [
    RelationalClientPersistenceModule, 
    forwardRef(() => UsersModule),
    forwardRef(() => ProjectAssignedClientModule),
    forwardRef(() => ClientFavoriteProjectsModule),
    forwardRef(() => ClientFavoriteReportsModule),
    forwardRef(() => ReportModule),
    forwardRef(() => ProjectModule)
  ],
  controllers: [ClientController],
  providers: [ClientService],
  exports: [ClientService, RelationalClientPersistenceModule],
})
export class ClientModule {}
