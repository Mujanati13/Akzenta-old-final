import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ProjectAssignedClientEntity } from './entities/project-assigned-client.entity';
import { ProjectAssignedClientRepository } from '../project-assigned-client.repository';
import { ProjectAssignedClientRelationalRepository } from './repositories/project-assigned-client.repository';

@Module({
  imports: [TypeOrmModule.forFeature([ProjectAssignedClientEntity])],
  providers: [
    {
      provide: ProjectAssignedClientRepository,
      useClass: ProjectAssignedClientRelationalRepository,
    },
  ],
    exports: [ProjectAssignedClientRepository],
})
export class RelationalProjectAssignedClientPersistenceModule {}