import {
  Module,
} from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { RelationalSessionPersistenceModule } from './infrastructure/persistence/relational/relational-persistence.module';
import { SessionService } from './session.service';

const infrastructurePersistenceModule = RelationalSessionPersistenceModule;

@Module({
  imports: [ConfigModule, infrastructurePersistenceModule],
  providers: [SessionService],
  exports: [SessionService, infrastructurePersistenceModule],
})
export class SessionModule {}
