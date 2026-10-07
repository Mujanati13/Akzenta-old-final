import {
  Column,
  CreateDateColumn,
  Entity,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';
import { EntityRelationalHelper } from '../../../../../utils/relational-entity-helper';
import { QuestionEntity } from '../../../../../question/infrastructure/persistence/relational/entities/question.entity';
import { QuestionOptionEntity } from '../../../../../question-option/infrastructure/persistence/relational/entities/question-option.entity';
import { ReportEntity } from '../../../../../report/infrastructure/persistence/relational/entities/report.entity';

@Entity({
  name: 'answer',
})
export class AnswerEntity extends EntityRelationalHelper {
  @PrimaryGeneratedColumn()
  id: number;

  @ManyToOne(() => QuestionEntity, {
    eager: true,
  })
  @JoinColumn({ name: 'question_id' })
  question: QuestionEntity;

  @ManyToOne(() => QuestionOptionEntity, {
    eager: true,
    nullable: true,
  })
  @JoinColumn({ name: 'selected_option' })
  selectedOption: QuestionOptionEntity | null;

  @ManyToOne(() => ReportEntity, report => report.answers)
  @JoinColumn({ name: 'report_id' })
  report: ReportEntity;

  @Column({ 
    name: 'text_answer', 
    type: 'text',
    nullable: true 
  })
  textAnswer: string | null;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}