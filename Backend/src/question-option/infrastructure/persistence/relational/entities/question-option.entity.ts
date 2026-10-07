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

@Entity({
  name: 'question_option',
})
export class QuestionOptionEntity extends EntityRelationalHelper {
  @PrimaryGeneratedColumn()
  id: number;

  @ManyToOne(() => QuestionEntity, {
    eager: true,
  })
  @JoinColumn({ name: 'question_id' })
  question: QuestionEntity;

  @Column({ name: 'option_text' })
  optionText: string;

  @Column()
  order: number;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}