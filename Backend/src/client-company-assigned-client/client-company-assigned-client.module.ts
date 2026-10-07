import { Module, forwardRef } from '@nestjs/common';
import { ClientCompanyAssignedClientService } from './client-company-assigned-client.service';
import { RelationalClientCompanyAssignedClientPersistenceModule } from './infrastructure/persistence/relational/relational-persistence.module';
import { ClientCompanyAssignedClientController } from './client-company-assigned-client.controller';
import { ClientModule } from '../client/client.module';
import { ClientCompanyModule } from '../client-company/client-company.module';

const infrastructurePersistenceModule = RelationalClientCompanyAssignedClientPersistenceModule;

@Module({
  imports: [
    infrastructurePersistenceModule,
    forwardRef(() => ClientModule),
    forwardRef(() => ClientCompanyModule),
  ],
  controllers: [ClientCompanyAssignedClientController],
  providers: [ClientCompanyAssignedClientService],
  exports: [ClientCompanyAssignedClientService, infrastructurePersistenceModule],
})
export class ClientCompanyAssignedClientModule {}