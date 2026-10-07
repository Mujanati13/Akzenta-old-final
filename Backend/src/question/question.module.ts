import { forwardRef, Module } from '@nestjs/common';
import { QuestionService } from './question.service';
import { QuestionController } from './question.controller';
import { RelationalQuestionPersistenceModule } from './infrastructure/persistence/relational/relational-persistence.module';
import { AnswerTypeModule } from '../answer-type/answer-type.module';
import { ProjectModule } from '../project/project.module';

@Module({
  imports: [
    RelationalQuestionPersistenceModule,
    forwardRef(() => ProjectModule),
    forwardRef(() => AnswerTypeModule),
  ],
  controllers: [QuestionController],
  providers: [QuestionService],
  exports: [QuestionService, RelationalQuestionPersistenceModule],
})
export class QuestionModule {}