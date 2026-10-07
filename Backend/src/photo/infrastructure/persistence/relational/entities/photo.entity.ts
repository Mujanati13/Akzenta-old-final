import {
  CreateDateColumn,
  Entity,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
  ManyToOne,
  JoinColumn,
  Column,
} from 'typeorm';
import { EntityRelationalHelper } from '../../../../../utils/relational-entity-helper';
import { ProjectEntity } from '../../../../../project/infrastructure/persistence/relational/entities/project.entity';

@Entity({
  name: 'photo',
})
export class PhotoEntity extends EntityRelationalHelper {
  @PrimaryGeneratedColumn()
  id: number;

  @ManyToOne(() => ProjectEntity, {
    eager: true,
  })
  @JoinColumn({ name: 'project_id' })
  project: ProjectEntity;

  @Column({ type: 'integer', nullable: false, name: 'order' })
  order: number;

  @Column({ type: 'boolean', nullable: true, name: 'is_before_after' })
  isBeforeAfter?: boolean | null;

  @Column({ name: 'is_visible' })
  isVisibleInReport: boolean;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
