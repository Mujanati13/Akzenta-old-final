import { Module } from '@nestjs/common';
import { UsersModule } from './users/users.module';
import { FilesModule } from './files/files.module';
import { AuthModule } from './auth/auth.module';
import databaseConfig from './database/config/database.config';
import authConfig from './auth/config/auth.config';
import appConfig from './config/app.config';
import mailConfig from './mail/config/mail.config';
import fileConfig from './files/config/file.config';
import path from 'path';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { HeaderResolver, I18nModule } from 'nestjs-i18n';
import { TypeOrmConfigService } from './database/typeorm-config.service';
import { MailModule } from './mail/mail.module';
import { HomeModule } from './home/home.module';
import { DataSource, DataSourceOptions } from 'typeorm';
import { AllConfigType } from './config/config.type';
import { SessionModule } from './session/session.module';
import { MailerModule } from './mailer/mailer.module';
import { CountriesModule } from './countries/countries.module';
import { AkzenteModule } from './akzente/akzente.module';
import { MerchandiserModule } from './merchandiser/merchandiser.module';
import { ClientModule } from './client/client.module';
import { ClientCompanyModule } from './client-company/client-company.module';
import { PhotoModule } from './photo/photo.module';
import { ProjectModule } from './project/project.module';
import { ProjectBranchModule } from './project-branch/project-branch.module';
import { ReportModule } from './report/report.module';
import { StatusModule } from './report-status/status.module';
import { AdvancedPhotoModule } from './advanced-photo/advanced-photo.module';
import { UploadedPhotosModule } from './uploaded-photos/uploaded-photos.module';
import { UploadedAdvancedPhotosModule } from './uploaded-advanced-photos/uploaded-advanced-photos.module';
import { AkzenteFavoriteClientsModule } from './akzente-favorite-clients/akzente-favorite-clients.module';
import { AkzenteFavoriteClientCompaniesModule } from './akzente-favorite-client-companies/akzente-favorite-client-companies.module';
import { AkzenteFavoriteReportsModule } from './akzente-favorite-reports/akzente-favorite-reports.module';
import { AkzenteFavoriteMerchandisersModule } from './akzente-favorite-merchandisers/akzente-favorite-merchandiser.module';
import { BranchModule } from './branch/branch.module';
import { MerchandiserFavoriteReportsModule } from './merchandiser-favorite-reports/merchandiser-favorite-reports.module';
import { LanguagesModule } from './languages/languages.module';
import { MerchandiserLanguagesModule } from './merchandiser-languages/merchandiser-languages.module';
import { JobTypesModule } from './job-types/job-types.module';
import { SpecializationsModule } from './specializations/specializations.module';
import { MerchandiserSpecializationsModule } from './merchandiser-specializations/merchandiser-specializations.module';
import { MerchandiserReferencesModule } from './merchandiser-references/merchandiser-references.module';
import { MerchandiserEducationModule } from './merchandiser-education/merchandiser-education.module';
import { MerchandiserFilesModule } from './merchandiser-files/merchandiser-files.module';
import { AnswerModule } from './answer/answer.module';
import { AnswerTypeModule } from './answer-type/answer-type.module';
import { QuestionModule } from './question/question.module';
import { QuestionOptionModule } from './question-option/question-option.module';
import { NotificationsModule } from './notifications/notifications.module';
import { CitiesModule } from './cities/cities.module';
import { ReviewModule } from './merchandiser-reviews/merchandiser-reviews.module';
import { AkzenteFavoriteProjectModule } from './akzente-favorite-projects/akzente-favorite-project.module';
import { ProjectAssignedClientModule } from './project-assigned-client/project-assigned-client.module';
import { ProjectAssignedAkzenteModule } from './project-assigned-akzente/project-assigned-akzente.module';
import { ClientCompanyAssignedAkzenteModule } from './client-company-assigned-akzente/client-company-assigned-akzente.module';
import { ClientCompanyAssignedClientModule } from './client-company-assigned-client/client-company-assigned-client.module';
import { ClientFavoriteReportsModule } from './client-favorite-reports/client-favorite-reports.module';
import { ClientFavoriteProjectsModule } from './client-favorite-projects/client-favorite-projects.module';
import { MerchandiserFavoriteProjectModule } from './merchandiser-favorite-projects/merchandiser-favorite-projects.module';
import { MerchandiserFavoriteClientCompanyModule } from './merchandiser-favorite-client-companies/merchandiser-favorite-client-companies.module';
import { SupportModule } from './support/support.module';
import { SupportMailModule } from './support-mails/support-mail.module';
import { PublicModule } from './public/public.module';
import { ScheduleModule } from '@nestjs/schedule';

const infrastructureDatabaseModule = TypeOrmModule.forRootAsync({
  useClass: TypeOrmConfigService,
  dataSourceFactory: async (options: DataSourceOptions) => {
    return new DataSource(options).initialize();
  },
});

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      load: [databaseConfig, authConfig, appConfig, mailConfig, fileConfig],
      envFilePath: ['.env'],
    }),
    infrastructureDatabaseModule,
    I18nModule.forRootAsync({
      useFactory: (configService: ConfigService<AllConfigType>) => ({
        fallbackLanguage: configService.getOrThrow('app.fallbackLanguage', {
          infer: true,
        }),
        loaderOptions: { path: path.join(__dirname, '../i18n/'), watch: true },
      }),
      resolvers: [
        {
          use: HeaderResolver,
          useFactory: (configService: ConfigService<AllConfigType>) => {
            return [
              configService.get('app.headerLanguage', {
                infer: true,
              }),
            ];
          },
          inject: [ConfigService],
        },
      ],
      imports: [ConfigModule],
      inject: [ConfigService],
    }),
    ScheduleModule.forRoot(),
    UsersModule,
    FilesModule,
    AuthModule,
    SessionModule,
    MailModule,
    MailerModule,
    HomeModule,
    CitiesModule,
    CountriesModule,
    AkzenteModule,
    MerchandiserModule,
    ClientModule,
    ClientCompanyModule,
    PhotoModule,
    ProjectModule,
    BranchModule,
    ProjectBranchModule,
    ReportModule,
    StatusModule,
    UploadedPhotosModule,
    AdvancedPhotoModule,
    UploadedAdvancedPhotosModule,
    AkzenteFavoriteReportsModule,
    AkzenteFavoriteClientCompaniesModule,
    AkzenteFavoriteClientsModule,
    AkzenteFavoriteMerchandisersModule,
    MerchandiserFavoriteReportsModule,
    AkzenteFavoriteProjectModule,
    LanguagesModule,
    MerchandiserLanguagesModule,
    JobTypesModule,
    SpecializationsModule,
    MerchandiserSpecializationsModule,
    MerchandiserReferencesModule,
    MerchandiserEducationModule,
    MerchandiserFilesModule,
    AnswerModule,
    AnswerTypeModule,
    QuestionModule,
    QuestionOptionModule,
    NotificationsModule,
    ReviewModule,
    ProjectAssignedClientModule,
    ProjectAssignedAkzenteModule,
    ClientCompanyAssignedAkzenteModule,
    ClientCompanyAssignedClientModule,
    ClientFavoriteReportsModule,
    ClientFavoriteProjectsModule,
    MerchandiserFavoriteProjectModule,
    MerchandiserFavoriteClientCompanyModule,
    SupportModule,
    SupportMailModule,
    PublicModule,
  ],
})
export class AppModule {}
