import { Module, forwardRef } from '@nestjs/common';
import { MerchandiserSpecializationsService } from './merchandiser-specializations.service';
import { MerchandiserSpecializationsController } from './merchandiser-specializations.controller';
import { RelationalMerchandiserSpecializationsPersistenceModule } from './infrastructure/persistence/relational/relational-persistence.module';
import { MerchandiserModule } from '../merchandiser/merchandiser.module';
import { SpecializationsModule } from '../specializations/specializations.module';

@Module({
  imports: [
    RelationalMerchandiserSpecializationsPersistenceModule,
    forwardRef(() => MerchandiserModule),
    SpecializationsModule,
  ],
  controllers: [MerchandiserSpecializationsController],
  providers: [MerchandiserSpecializationsService],
  exports: [MerchandiserSpecializationsService, RelationalMerchandiserSpecializationsPersistenceModule],
})
export class MerchandiserSpecializationsModule {}