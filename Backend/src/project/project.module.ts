import { Module, forwardRef } from '@nestjs/common';
import { ProjectService } from './project.service';
import { ProjectController } from './project.controller';
import { RelationalProjectPersistenceModule } from './infrastructure/persistence/relational/relational-persistence.module';
import { ClientCompanyModule } from '../client-company/client-company.module';
import { PhotoService } from '../photo/photo.service';
import { AdvancedPhotoService } from '../advanced-photo/advanced-photo.service';
import { QuestionService } from '../question/question.service';
import { QuestionOptionService } from '../question-option/question-option.service';
import { PhotoModule } from '../photo/photo.module';
import { AdvancedPhotoModule } from '../advanced-photo/advanced-photo.module';
import { QuestionModule } from '../question/question.module';
import { QuestionOptionModule } from '../question-option/question-option.module';
import { AnswerTypeModule } from '../answer-type/answer-type.module';
import { ReportModule } from '../report/report.module';
import { ProjectAssignedClientModule } from '../project-assigned-client/project-assigned-client.module';
import { ProjectAssignedAkzenteModule } from '../project-assigned-akzente/project-assigned-akzente.module';
import { ClientModule } from '../client/client.module';
import { AkzenteModule } from '../akzente/akzente.module';
import { AkzenteFavoriteProjectModule } from '../akzente-favorite-projects/akzente-favorite-project.module';
import { ClientFavoriteProjectsModule } from '../client-favorite-projects/client-favorite-projects.module';
import { MerchandiserFavoriteProjectModule } from '../merchandiser-favorite-projects/merchandiser-favorite-projects.module';
import { MerchandiserModule } from '../merchandiser/merchandiser.module';
import { UsersModule } from '../users/users.module';

@Module({
  imports: [
    RelationalProjectPersistenceModule,
    forwardRef(() => ClientCompanyModule),
    forwardRef(() => PhotoModule),
    forwardRef(() => AdvancedPhotoModule),
    forwardRef(() => QuestionModule),
    forwardRef(() => QuestionOptionModule),
    forwardRef(() => ReportModule),
    forwardRef(() => AnswerTypeModule),
    forwardRef(() => ProjectAssignedClientModule),
    forwardRef(() => ProjectAssignedAkzenteModule),
    forwardRef(() => ClientModule),
    forwardRef(() => AkzenteModule),
    forwardRef(() => AkzenteFavoriteProjectModule),
    forwardRef(() => ClientFavoriteProjectsModule),
    forwardRef(() => MerchandiserFavoriteProjectModule),
    forwardRef(() => MerchandiserModule),
    forwardRef(() => UsersModule),
  ],
  controllers: [ProjectController],
  providers: [
    ProjectService,
    PhotoService,
    AdvancedPhotoService,
    QuestionService,
    QuestionOptionService,
  ],
  exports: [ProjectService, RelationalProjectPersistenceModule],
})
export class ProjectModule {}
