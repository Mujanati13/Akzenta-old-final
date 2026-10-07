import { Module } from '@nestjs/common';
import { StatusService } from './status.service';
import { StatusController } from './status.controller';
import { RelationalStatusPersistenceModule } from './infrastructure/persistence/relational/relational-persistence.module';

@Module({
  imports: [RelationalStatusPersistenceModule],
  controllers: [StatusController],
  providers: [StatusService],
  exports: [StatusService, RelationalStatusPersistenceModule],
})
export class StatusModule {}
