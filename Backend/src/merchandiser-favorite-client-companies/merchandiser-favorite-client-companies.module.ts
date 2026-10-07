import { Module, forwardRef } from '@nestjs/common';
import { MerchandiserFavoriteClientCompanyService } from './merchandiser-favorite-client-companies.service';
import { MerchandiserFavoriteClientCompanyController } from './merchandiser-favorite-client-companies.controller';
import { RelationalMerchandiserFavoriteClientCompanyPersistenceModule } from './infrastructure/persistence/relational/relational-persistence.module';
import { MerchandiserModule } from '../merchandiser/merchandiser.module';
import { ClientCompanyModule } from '../client-company/client-company.module';

@Module({
  imports: [
    RelationalMerchandiserFavoriteClientCompanyPersistenceModule,
    forwardRef(() => MerchandiserModule),
    forwardRef(() => ClientCompanyModule),
  ],
  controllers: [MerchandiserFavoriteClientCompanyController],
  providers: [MerchandiserFavoriteClientCompanyService],
  exports: [MerchandiserFavoriteClientCompanyService],
})
export class MerchandiserFavoriteClientCompanyModule {}
