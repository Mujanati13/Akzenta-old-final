import { Module, forwardRef } from '@nestjs/common';
import { MerchandiserModule } from '../merchandiser/merchandiser.module';
import { JobTypesModule } from '../job-types/job-types.module';
import { LanguagesModule } from '../languages/languages.module';
import { RelationalMerchandiserJobTypesPersistenceModule } from './infrastructure/persistence/relational/relational-persistence.module';
import { MerchandiserJobTypesController } from './merchandiser-job-types.controller';
import { MerchandiserJobTypesService } from './merchandiser-job-types.service';

@Module({
  imports: [
    RelationalMerchandiserJobTypesPersistenceModule,
    forwardRef(() => MerchandiserModule),
    JobTypesModule,
    LanguagesModule,
  ],
  controllers: [MerchandiserJobTypesController],
  providers: [MerchandiserJobTypesService],
  exports: [MerchandiserJobTypesService, RelationalMerchandiserJobTypesPersistenceModule],
})
export class MerchandiserJobTypesModule {}