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
import { AdvancedPhotoEntity } from '../../../../../advanced-photo/infrastructure/persistence/relational/entities/advanced-photo.entity';
import { FileEntity } from '../../../../../files/infrastructure/persistence/relational/entities/file.entity';
import { ReportEntity } from '../../../../../report/infrastructure/persistence/relational/entities/report.entity';

@Entity({
  name: 'uploaded_advanced_photo',
})
export class UploadedAdvancedPhotoEntity extends EntityRelationalHelper {
  @PrimaryGeneratedColumn()
  id: number;

  @ManyToOne(() => AdvancedPhotoEntity, {
    eager: true,
  })
  @JoinColumn({ name: 'advanced_photo_id' })
  advancedPhoto: AdvancedPhotoEntity;

  @ManyToOne(() => FileEntity, {
    eager: true,
  })
  @JoinColumn({ name: 'file_id' })
  file: FileEntity;

  @ManyToOne(() => ReportEntity, {
    eager: true,
  })
  @JoinColumn({ name: 'report_id' })
  report: ReportEntity;

  @Column({ type: 'varchar', nullable: true })
  label?: string | null;

  @Column({ type: 'varchar', nullable: true })
  beforeAfterType?: 'before' | 'after' | null;

  @Column({ type: 'int', name: 'order_index', default: 0 })
  order: number;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
