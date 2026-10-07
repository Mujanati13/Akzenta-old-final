import { Module } from '@nestjs/common';
import { SupportService } from './support.service';
import { SupportController } from './support.controller';
import { RelationalSupportPersistenceModule } from './infrastructure/persistence/relational/relational-persistence.module';

@Module({
  imports: [RelationalSupportPersistenceModule],
  controllers: [SupportController],
  providers: [SupportService],
  exports: [SupportService, RelationalSupportPersistenceModule],
})
export class SupportModule {}

