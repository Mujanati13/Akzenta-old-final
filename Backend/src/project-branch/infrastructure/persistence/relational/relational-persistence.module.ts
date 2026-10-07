import { Module } from '@nestjs/common';
import { ProjectBranchRepository } from '../project-branch.repository';
import { ProjectBranchRelationalRepository } from './repositories/project-branch.repository';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ProjectBranchEntity } from './entities/project-branch.entity';

@Module({
  imports: [TypeOrmModule.forFeature([ProjectBranchEntity])],
  providers: [
    {
      provide: ProjectBranchRepository,
      useClass: ProjectBranchRelationalRepository,
    },
  ],
  exports: [ProjectBranchRepository],
})
export class RelationalProjectBranchPersistenceModule {}
