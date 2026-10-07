import { Module, forwardRef } from '@nestjs/common';
import { ProjectAssignedAkzenteService } from './project-assigned-akzente.service';
import { RelationalProjectAssignedAkzentePersistenceModule } from './infrastructure/persistence/relational/relational-persistence.module';
import { ProjectAssignedAkzenteController } from './project-assigned-akzente.controller';
import { ProjectModule } from '../project/project.module';
import { AkzenteModule } from '../akzente/akzente.module';

const infrastructurePersistenceModule = RelationalProjectAssignedAkzentePersistenceModule;

@Module({
  imports: [
    infrastructurePersistenceModule,
    forwardRef(() => ProjectModule),
    forwardRef(() => AkzenteModule),
  ],
  controllers: [ProjectAssignedAkzenteController],
  providers: [ProjectAssignedAkzenteService],
  exports: [ProjectAssignedAkzenteService, infrastructurePersistenceModule],
})
export class ProjectAssignedAkzenteModule {}