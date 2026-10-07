import { Module, forwardRef } from '@nestjs/common';
import { QuestionOptionService } from './question-option.service';
import { QuestionOptionController } from './question-option.controller';
import { RelationalQuestionOptionPersistenceModule } from './infrastructure/persistence/relational/relational-persistence.module';
import { QuestionModule } from '../question/question.module';

@Module({
  imports: [
    RelationalQuestionOptionPersistenceModule,
    forwardRef(() => QuestionModule),
  ],
  controllers: [QuestionOptionController],
  providers: [QuestionOptionService],
  exports: [QuestionOptionService, RelationalQuestionOptionPersistenceModule],
})
export class QuestionOptionModule {}