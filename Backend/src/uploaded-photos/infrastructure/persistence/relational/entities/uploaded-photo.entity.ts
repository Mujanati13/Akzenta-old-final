import {
  CreateDateColumn,
  Entity,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
  ManyToOne,
  JoinColumn,
} from 'typeorm';
import { EntityRelationalHelper } from '../../../../../utils/relational-entity-helper';
import { PhotoEntity } from '../../../../../photo/infrastructure/persistence/relational/entities/photo.entity';
import { FileEntity } from '../../../../../files/infrastructure/persistence/relational/entities/file.entity';
import { ReportEntity } from '../../../../../report/infrastructure/persistence/relational/entities/report.entity';

@Entity({
  name: 'uploaded_photo',
})
export class UploadedPhotoEntity extends EntityRelationalHelper {
  @PrimaryGeneratedColumn()
  id: number;

  @ManyToOne(() => PhotoEntity, {
    eager: true,
  })
  @JoinColumn({ name: 'photo_id' })
  photo: PhotoEntity;

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

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
