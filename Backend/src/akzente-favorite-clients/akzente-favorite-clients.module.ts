import { Module } from '@nestjs/common';
import { AkzenteFavoriteClientsService } from './akzente-favorite-clients.service';
import { AkzenteFavoriteClientsController } from './akzente-favorite-clients.controller';
import { RelationalAkzenteFavoriteClientPersistenceModule } from './infrastructure/persistence/relational/relational-persistence.module';
import { AkzenteModule } from '../akzente/akzente.module';
import { ClientModule } from '../client/client.module';

@Module({
  imports: [
    RelationalAkzenteFavoriteClientPersistenceModule,
    AkzenteModule,
    ClientModule,
  ],
  controllers: [AkzenteFavoriteClientsController],
  providers: [AkzenteFavoriteClientsService],
  exports: [AkzenteFavoriteClientsService, RelationalAkzenteFavoriteClientPersistenceModule],
})
export class AkzenteFavoriteClientsModule {}