import { Module } from '@nestjs/common';
import { AnswerTypeRepository } from '../answer-type.repository';
import { AnswerTypeRelationalRepository } from './repositories/answer-type.repository';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AnswerTypeEntity } from './entities/answer-type.entity';

@Module({
  imports: [TypeOrmModule.forFeature([AnswerTypeEntity])],
  providers: [
    {
      provide: AnswerTypeRepository,
      useClass: AnswerTypeRelationalRepository,
    },
  ],
  exports: [AnswerTypeRepository],
})
export class RelationalAnswerTypePersistenceModule {}