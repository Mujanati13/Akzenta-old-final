import { Module, forwardRef } from '@nestjs/common';
import { MerchandiserEducationService } from './merchandiser-education.service';
import { MerchandiserEducationController } from './merchandiser-education.controller';
import { RelationalMerchandiserEducationPersistenceModule } from './infrastructure/persistence/relational/relational-persistence.module';
import { MerchandiserModule } from '../merchandiser/merchandiser.module';

@Module({
  imports: [
    RelationalMerchandiserEducationPersistenceModule,
    forwardRef(() => MerchandiserModule),
  ],
  controllers: [MerchandiserEducationController],
  providers: [MerchandiserEducationService],
  exports: [MerchandiserEducationService, RelationalMerchandiserEducationPersistenceModule],
})
export class MerchandiserEducationModule {}