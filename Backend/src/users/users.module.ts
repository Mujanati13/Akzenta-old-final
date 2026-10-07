import {
  // common
  Module,
  forwardRef,
} from '@nestjs/common';

import { UsersController } from './users.controller';

import { UsersService } from './users.service';
import { RelationalUserPersistenceModule } from './infrastructure/persistence/relational/relational-persistence.module';
import { FilesModule } from '../files/files.module';
import { SessionModule } from '../session/session.module';
import { AkzenteModule } from '../akzente/akzente.module';
import { ClientModule } from '../client/client.module';
import { AkzenteFavoriteClientCompaniesModule } from '../akzente-favorite-client-companies/akzente-favorite-client-companies.module';
import { ClientCompanyAssignedClientModule } from '../client-company-assigned-client/client-company-assigned-client.module';
import { ClientCompanyAssignedAkzenteModule } from '../client-company-assigned-akzente/client-company-assigned-akzente.module';
import { MailModule } from '../mail/mail.module';

const infrastructurePersistenceModule = RelationalUserPersistenceModule;

@Module({
  imports: [
    // import modules, etc.
    infrastructurePersistenceModule,
    FilesModule,
    SessionModule,
    forwardRef(() => AkzenteModule),
    forwardRef(() => ClientModule),
    forwardRef(() => AkzenteFavoriteClientCompaniesModule),
    forwardRef(() => ClientCompanyAssignedClientModule),
    forwardRef(() => ClientCompanyAssignedAkzenteModule),
    MailModule, // Add this import to fix DI error
  ],
  controllers: [UsersController],
  providers: [UsersService],
  exports: [UsersService, infrastructurePersistenceModule],
})
export class UsersModule {}
