import { Module, forwardRef } from '@nestjs/common';
import { ProjectAssignedClientService } from './project-assigned-client.service';
import { RelationalProjectAssignedClientPersistenceModule } from './infrastructure/persistence/relational/relational-persistence.module';
import { ProjectAssignedClientController } from './project-assigned-client.controller';
import { ProjectModule } from '../project/project.module';
import { ClientModule } from '../client/client.module';

const infrastructurePersistenceModule = RelationalProjectAssignedClientPersistenceModule;

@Module({
  imports: [
    infrastructurePersistenceModule,
    forwardRef(() => ProjectModule),
    forwardRef(() => ClientModule),
  ],
  controllers: [ProjectAssignedClientController],
  providers: [ProjectAssignedClientService],
  exports: [ProjectAssignedClientService, infrastructurePersistenceModule],
})
export class ProjectAssignedClientModule {}