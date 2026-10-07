import { Module, forwardRef } from '@nestjs/common';
import { MerchandiserReferencesService } from './merchandiser-references.service';
import { MerchandiserReferencesController } from './merchandiser-references.controller';
import { RelationalMerchandiserReferencesPersistenceModule } from './infrastructure/persistence/relational/relational-persistence.module';
import { MerchandiserModule } from '../merchandiser/merchandiser.module';

@Module({
  imports: [
    RelationalMerchandiserReferencesPersistenceModule,
    forwardRef(() => MerchandiserModule),
  ],
  controllers: [MerchandiserReferencesController],
  providers: [MerchandiserReferencesService],
  exports: [MerchandiserReferencesService, RelationalMerchandiserReferencesPersistenceModule],
})
export class MerchandiserReferencesModule {}