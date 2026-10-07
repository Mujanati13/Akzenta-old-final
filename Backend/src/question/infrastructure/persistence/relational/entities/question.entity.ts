import {
  Column,
  CreateDateColumn,
  Entity,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
  OneToMany,
} from 'typeorm';
import { EntityRelationalHelper } from '../../../../../utils/relational-entity-helper';
import { ReportEntity } from '../../../../../report/infrastructure/persistence/relational/entities/report.entity';
import { AnswerTypeEntity } from '../../../../../answer-type/infrastructure/persistence/relational/entities/answer-type.entity';
import { ProjectEntity } from '../../../../../project/infrastructure/persistence/relational/entities/project.entity';
import { QuestionOptionEntity } from '../../../../../question-option/infrastructure/persistence/relational/entities/question-option.entity';

@Entity({
  name: 'question',
})
export class QuestionEntity extends EntityRelationalHelper {
  @PrimaryGeneratedColumn()
  id: number;

  @ManyToOne(() => ProjectEntity, {
    eager: true,
  })
  @JoinColumn({ name: 'project_id' })
  project: ProjectEntity;

  @ManyToOne(() => AnswerTypeEntity, {
    eager: true,
  })
  @JoinColumn({ name: 'answer_type_id' })
  answerType: AnswerTypeEntity;

  @Column({ name: 'question_text' })
  questionText: string;

  @Column({ name: 'is_required' })
  isRequired: boolean;

  @Column({ name: 'is_visible_to_client' })
  isVisibleToClient: boolean;

  @Column({ name: 'show_in_overview', default: false })
  showInOverview: boolean;

  @OneToMany(() => QuestionOptionEntity, option => option.question)
  options: QuestionOptionEntity[];

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}