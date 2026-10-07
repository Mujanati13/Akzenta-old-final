import { Module, forwardRef } from '@nestjs/common';
import { ProjectBranchService } from './project-branch.service';
import { ProjectBranchController } from './project-branch.controller';
import { RelationalProjectBranchPersistenceModule } from './infrastructure/persistence/relational/relational-persistence.module';
import { ProjectModule } from '../project/project.module';
import { BranchModule } from '../branch/branch.module';

@Module({
  imports: [
    RelationalProjectBranchPersistenceModule,
    forwardRef(() => ProjectModule),
    BranchModule,
  ],
  controllers: [ProjectBranchController],
  providers: [ProjectBranchService],
  exports: [ProjectBranchService, RelationalProjectBranchPersistenceModule],
})
export class ProjectBranchModule {}
