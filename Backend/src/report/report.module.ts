import { forwardRef, Module } from '@nestjs/common';
import { ReportService } from './report.service';
import { ReportController } from './report.controller';
import { RelationalReportPersistenceModule } from './infrastructure/persistence/relational/relational-persistence.module';
import { ProjectModule } from '../project/project.module';
import { ClientCompanyModule } from '../client-company/client-company.module';
import { MerchandiserModule } from '../merchandiser/merchandiser.module';
import { BranchModule } from '../branch/branch.module';
import { ProjectBranchModule } from '../project-branch/project-branch.module';
import { StatusModule } from '../report-status/status.module';
import { CitiesModule } from '../cities/cities.module';
import { QuestionModule } from '../question/question.module';
import { AnswerModule } from '../answer/answer.module';
import { QuestionOptionModule } from '../question-option/question-option.module';
import { ConversationModule } from '../conversation/conversation.module';
import { MessageModule } from '../message/message.module';
import { UsersModule } from '../users/users.module';
import { ClientCompanyAssignedClientModule } from '../client-company-assigned-client/client-company-assigned-client.module';
import { ProjectAssignedClientModule } from '../project-assigned-client/project-assigned-client.module';
import { PhotoModule } from '../photo/photo.module';
import { AdvancedPhotoModule } from '../advanced-photo/advanced-photo.module';
import { UploadedAdvancedPhotosModule } from '../uploaded-advanced-photos/uploaded-advanced-photos.module';
import { FilesLocalModule } from '../files/infrastructure/uploader/local/files.module';
import { MulterModule } from '@nestjs/platform-express';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { AllConfigType } from '../config/config.type';
import { diskStorage } from 'multer';
import { randomStringGenerator } from '@nestjs/common/utils/random-string-generator.util';
import { AkzenteFavoriteReportsModule } from '../akzente-favorite-reports/akzente-favorite-reports.module';
import { AkzenteModule } from '../akzente/akzente.module';
import { ClientModule } from '../client/client.module';
import { ClientFavoriteReportsModule } from '../client-favorite-reports/client-favorite-reports.module';
import { MerchandiserFavoriteReportsModule } from '../merchandiser-favorite-reports/merchandiser-favorite-reports.module';
import { ReportStatusSchedulerService } from './report-status-scheduler.service';
import { NotificationsModule } from '../notifications/notifications.module';
import { ProjectAssignedAkzenteModule } from '../project-assigned-akzente/project-assigned-akzente.module';
import { MailerModule } from '../mailer/mailer.module';
import { MerchandiserFilesModule } from '../merchandiser-files/merchandiser-files.module';

@Module({
  imports: [
    RelationalReportPersistenceModule,
    forwardRef(() => ProjectModule),
    forwardRef(() => StatusModule),
    forwardRef(() => ClientCompanyModule),
    forwardRef(() => MerchandiserModule),
    forwardRef(() => BranchModule),
    forwardRef(() => ProjectBranchModule),
    forwardRef(() => CitiesModule),
    forwardRef(() => QuestionModule),
    forwardRef(() => AnswerModule),
    forwardRef(() => QuestionOptionModule),
    ConversationModule,
    MessageModule,
    forwardRef(() => UsersModule),
    forwardRef(() => ClientCompanyAssignedClientModule),
    forwardRef(() => ProjectAssignedClientModule),
    PhotoModule,
    AdvancedPhotoModule,
    forwardRef(() => UploadedAdvancedPhotosModule),
    FilesLocalModule,
    forwardRef(() => AkzenteFavoriteReportsModule),
    forwardRef(() => AkzenteModule),
    forwardRef(() => ClientModule),
    forwardRef(() => ClientFavoriteReportsModule),
    forwardRef(() => MerchandiserFavoriteReportsModule),
    forwardRef(() => NotificationsModule),
    forwardRef(() => ProjectAssignedAkzenteModule),
    MailerModule,
    forwardRef(() => MerchandiserFilesModule),
    MulterModule.registerAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (configService: ConfigService<AllConfigType>) => {
        return {
          storage: diskStorage({
            destination: './uploads',
            filename: (request, file, callback) => {
              callback(
                null,
                `${randomStringGenerator()}.${file.originalname
                  .split('.')
                  .pop()
                  ?.toLowerCase()}`,
              );
            },
          }),
          limits: {
            fileSize: configService.get('file.maxFileSize', { infer: true }),
          },
        };
      },
    }),
  ],
  controllers: [ReportController],
  providers: [ReportService, ReportStatusSchedulerService],
  exports: [ReportService, RelationalReportPersistenceModule],
})
export class ReportModule {}
