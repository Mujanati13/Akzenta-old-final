import { Module, forwardRef } from '@nestjs/common';
import { ClientCompanyAssignedAkzenteService } from './client-company-assigned-akzente.service';
import { RelationalClientCompanyAssignedAkzentePersistenceModule } from './infrastructure/persistence/relational/relational-persistence.module';
import { ClientCompanyAssignedAkzenteController } from './client-company-assigned-akzente.controller';
import { ClientModule } from '../client/client.module';
import { ClientCompanyModule } from '../client-company/client-company.module';

const infrastructurePersistenceModule = RelationalClientCompanyAssignedAkzentePersistenceModule;

@Module({
  imports: [
    infrastructurePersistenceModule,
    forwardRef(() => ClientModule),
    forwardRef(() => ClientCompanyModule),
  ],
  controllers: [ClientCompanyAssignedAkzenteController],
  providers: [ClientCompanyAssignedAkzenteService],
  exports: [ClientCompanyAssignedAkzenteService, infrastructurePersistenceModule],
})
export class ClientCompanyAssignedAkzenteModule {}