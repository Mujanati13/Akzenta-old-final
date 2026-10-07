import { Module, forwardRef } from '@nestjs/common';
import { MerchandiserService } from './merchandiser.service';
import { MerchandiserController } from './merchandiser.controller';
import { RelationalMerchandiserPersistenceModule } from './infrastructure/persistence/relational/relational-persistence.module';
import { UsersModule } from '../users/users.module';
import { JobTypesModule } from '../job-types/job-types.module';
import { CitiesModule } from '../cities/cities.module';
import { CountriesModule } from '../countries/countries.module';
import { LanguagesModule } from '../languages/languages.module';
import { SessionModule } from '../session/session.module';
import { MailModule } from '../mail/mail.module';
import { SpecializationsModule } from '../specializations/specializations.module';
import { MerchandiserLanguagesModule } from '../merchandiser-languages/merchandiser-languages.module';
import { MerchandiserSpecializationsModule } from '../merchandiser-specializations/merchandiser-specializations.module';
import { MerchandiserReferencesModule } from '../merchandiser-references/merchandiser-references.module';
import { MerchandiserEducationModule } from '../merchandiser-education/merchandiser-education.module';
import { MerchandiserFilesModule } from '../merchandiser-files/merchandiser-files.module';
import { MerchandiserJobTypesModule } from '../merchandiser-job-types/merchandiser-job-types.module';
import { AkzenteFavoriteMerchandisersModule } from '../akzente-favorite-merchandisers/akzente-favorite-merchandiser.module';
import { AkzenteModule } from '../akzente/akzente.module';
import { ReviewModule } from '../merchandiser-reviews/merchandiser-reviews.module';
import { ContractualsModule } from '../contractuals/contractuals.module';
import { MerchandiserStatusModule } from '../merchandiser-statuses/status.module';
import { MerchandiserFavoriteReportsModule } from '../merchandiser-favorite-reports/merchandiser-favorite-reports.module';
import { MerchandiserFavoriteProjectModule } from '../merchandiser-favorite-projects/merchandiser-favorite-projects.module';
import { MerchandiserFavoriteClientCompanyModule } from '../merchandiser-favorite-client-companies/merchandiser-favorite-client-companies.module';
import { ReportModule } from '../report/report.module';
import { ClientCompanyModule } from '../client-company/client-company.module';
import { ClientCompanyAssignedClientModule } from '../client-company-assigned-client/client-company-assigned-client.module';
import { FilesLocalModule } from '../files/infrastructure/uploader/local/files.module';

@Module({
  imports: [
    RelationalMerchandiserPersistenceModule,
    forwardRef(() => UsersModule),
    forwardRef(() => JobTypesModule),
    forwardRef(() => ContractualsModule),
    forwardRef(() => CountriesModule),
    forwardRef(() => LanguagesModule),
    forwardRef(() => SessionModule),
    forwardRef(() => SpecializationsModule),
    forwardRef(() => CitiesModule),
    forwardRef(() => MerchandiserLanguagesModule),
    forwardRef(() => MerchandiserSpecializationsModule),
    forwardRef(() => MerchandiserReferencesModule),
    forwardRef(() => MerchandiserEducationModule),
    forwardRef(() => MerchandiserFilesModule),
    forwardRef(() => MerchandiserJobTypesModule),
    forwardRef(() => MerchandiserStatusModule),
    forwardRef(() => AkzenteFavoriteMerchandisersModule),
    forwardRef(() => AkzenteModule),
    forwardRef(() => ReviewModule),
    forwardRef(() => MerchandiserFavoriteReportsModule),
    forwardRef(() => MerchandiserFavoriteProjectModule),
    forwardRef(() => MerchandiserFavoriteClientCompanyModule),
    forwardRef(() => ReportModule),
    forwardRef(() => ClientCompanyModule),
    forwardRef(() => ClientCompanyAssignedClientModule),
    FilesLocalModule,
    MailModule,
  ],
  controllers: [MerchandiserController],
  providers: [MerchandiserService],
  exports: [MerchandiserService, RelationalMerchandiserPersistenceModule],
})
export class MerchandiserModule { }
