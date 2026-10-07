import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ClientCompanyAssignedAkzenteEntity } from './entities/client-company-assigned-akzente.entity';
import { ClientCompanyAssignedAkzenteRepository } from '../client-company-assigned-akzente.repository';
import { ClientCompanyAssignedAkzenteRelationalRepository } from './repositories/client-company-assigned-akzente.repository';

@Module({
  imports: [TypeOrmModule.forFeature([ClientCompanyAssignedAkzenteEntity])],
  providers: [
    {
      provide: ClientCompanyAssignedAkzenteRepository,
      useClass: ClientCompanyAssignedAkzenteRelationalRepository,
    },
  ],
    exports: [ClientCompanyAssignedAkzenteRepository],
})
export class RelationalClientCompanyAssignedAkzentePersistenceModule {}