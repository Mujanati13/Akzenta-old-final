import { Module } from '@nestjs/common';
import { MerchandiserStatusService } from './status.service';
import { MerchandiserStatusController } from './status.controller';
import { RelationalStatusPersistenceModule } from './infrastructure/persistence/relational/relational-persistence.module';

@Module({
  imports: [RelationalStatusPersistenceModule],
  controllers: [MerchandiserStatusController],
  providers: [MerchandiserStatusService],
  exports: [MerchandiserStatusService, RelationalStatusPersistenceModule],
})
export class MerchandiserStatusModule {}
