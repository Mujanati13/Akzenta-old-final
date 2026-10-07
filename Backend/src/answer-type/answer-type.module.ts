import { Module } from '@nestjs/common';
import { AnswerTypeService } from './answer-type.service';
import { AnswerTypeController } from './answer-type.controller';
import { RelationalAnswerTypePersistenceModule } from './infrastructure/persistence/relational/relational-persistence.module';

@Module({
  imports: [RelationalAnswerTypePersistenceModule],
  controllers: [AnswerTypeController],
  providers: [AnswerTypeService],
  exports: [AnswerTypeService, RelationalAnswerTypePersistenceModule],
})
export class AnswerTypeModule {}