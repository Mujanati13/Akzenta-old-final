import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ProjectAssignedAkzenteEntity } from './entities/project-assigned-akzente.entity';
import { ProjectAssignedAkzenteRepository } from '../project-assigned-akzente.repository';
import { ProjectAssignedAkzenteRelationalRepository } from './repositories/project-assigned-akzente.repository';

@Module({
  imports: [TypeOrmModule.forFeature([ProjectAssignedAkzenteEntity])],
  providers: [
    {
      provide: ProjectAssignedAkzenteRepository,
      useClass: ProjectAssignedAkzenteRelationalRepository,
    },
  ],
    exports: [ProjectAssignedAkzenteRepository],
})
export class RelationalProjectAssignedAkzentePersistenceModule {}