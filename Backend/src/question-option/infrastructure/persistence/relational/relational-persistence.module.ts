import { Module } from '@nestjs/common';
import { QuestionOptionRepository } from '../question-option.repository';
import { QuestionOptionRelationalRepository } from './repositories/question-option.repository';
import { TypeOrmModule } from '@nestjs/typeorm';
import { QuestionOptionEntity } from './entities/question-option.entity';

@Module({
  imports: [TypeOrmModule.forFeature([QuestionOptionEntity])],
  providers: [
    {
      provide: QuestionOptionRepository,
      useClass: QuestionOptionRelationalRepository,
    },
  ],
  exports: [QuestionOptionRepository],
})
export class RelationalQuestionOptionPersistenceModule {}