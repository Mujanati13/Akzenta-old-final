import { Module, forwardRef } from '@nestjs/common';
import { AnswerService } from './answer.service';
import { AnswerController } from './answer.controller';
import { RelationalAnswerPersistenceModule } from './infrastructure/persistence/relational/relational-persistence.module';
import { QuestionModule } from '../question/question.module';
import { QuestionOptionModule } from '../question-option/question-option.module';
import { ReportModule } from '../report/report.module';

@Module({
  imports: [
    RelationalAnswerPersistenceModule,
    QuestionModule,
    QuestionOptionModule,
    forwardRef(() => ReportModule),
  ],
  controllers: [AnswerController],
  providers: [AnswerService],
  exports: [AnswerService, RelationalAnswerPersistenceModule],
})
export class AnswerModule {}