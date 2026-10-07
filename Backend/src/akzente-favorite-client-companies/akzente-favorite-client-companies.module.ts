import { Module, forwardRef } from '@nestjs/common';
import { AkzenteFavoriteClientCompaniesService } from './akzente-favorite-client-companies.service';
import { AkzenteFavoriteClientCompaniesController } from './akzente-favorite-client-companies.controller';
import { RelationalAkzenteFavoriteClientCompanyPersistenceModule } from './infrastructure/persistence/relational/relational-persistence.module';
import { AkzenteModule } from '../akzente/akzente.module';
import { ClientCompanyModule } from '../client-company/client-company.module';

@Module({
  imports: [
    RelationalAkzenteFavoriteClientCompanyPersistenceModule,
    forwardRef(() => AkzenteModule),
    ClientCompanyModule,
  ],
  controllers: [AkzenteFavoriteClientCompaniesController],
  providers: [AkzenteFavoriteClientCompaniesService],
  exports: [
    AkzenteFavoriteClientCompaniesService,
    RelationalAkzenteFavoriteClientCompanyPersistenceModule,
  ],
})
export class AkzenteFavoriteClientCompaniesModule {}
