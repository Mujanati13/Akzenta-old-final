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
  name: 'advanced_photo',
})
export class AdvancedPhotoEntity extends EntityRelationalHelper {
  @PrimaryGeneratedColumn()
  id: number;

  @ManyToOne(() => ProjectEntity, {
    eager: true,
  })
  @JoinColumn({ name: 'project_id' })
  project: ProjectEntity;

  @Column({ type: 'text', array: true, nullable: false })
  labels: string[];

  @Column({ type: 'boolean', nullable: true, name: 'is_before_after' })
  isBeforeAfter?: boolean | null;

  @Column({ name: 'is_visible' })
  isVisibleInReport: boolean;

  @Column({ type: 'integer', nullable: true, name: 'before_image_count' })
  beforeImageCount?: number | null;

  @Column({ type: 'integer', nullable: true, name: 'after_image_count' })
  afterImageCount?: number | null;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
