import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ClientCompanyAssignedClientEntity } from './entities/client-company-assigned-client.entity';
import { ClientCompanyAssignedClientRepository } from '../client-company-assigned-client.repository';
import { ClientCompanyAssignedClientRelationalRepository } from './repositories/client-company-assigned-client.repository';

@Module({
  imports: [TypeOrmModule.forFeature([ClientCompanyAssignedClientEntity])],
  providers: [
    {
      provide: ClientCompanyAssignedClientRepository,
      useClass: ClientCompanyAssignedClientRelationalRepository,
    },
  ],
    exports: [ClientCompanyAssignedClientRepository],
})
export class RelationalClientCompanyAssignedClientPersistenceModule {}