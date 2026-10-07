import {
  CreateDateColumn,
  Entity,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
  ManyToOne,
  JoinColumn,
  Column,
  OneToMany,
} from 'typeorm';
import { EntityRelationalHelper } from '../../../../../utils/relational-entity-helper';
import { ClientCompanyEntity } from '../../../../../client-company/infrastructure/persistence/relational/entities/client-company.entity';
import { QuestionEntity } from '../../../../../question/infrastructure/persistence/relational/entities/question.entity';
import { PhotoEntity } from '../../../../../photo/infrastructure/persistence/relational/entities/photo.entity';
import { AdvancedPhotoEntity } from '../../../../../advanced-photo/infrastructure/persistence/relational/entities/advanced-photo.entity';

@Entity({
  name: 'project',
})
export class ProjectEntity extends EntityRelationalHelper {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ type: 'varchar', nullable: false })
  name: string;

  @Column({ type: 'date', nullable: true, name: 'start_date' })
  startDate?: Date | null;

  @Column({ type: 'date', nullable: true, name: 'end_date' })
  endDate?: Date | null;

  @Column({ type: 'boolean', default: false, name: 'is_spec_compliant_enabled' })
  isSpecCompliantEnabled: boolean;

  @Column({ type: 'text', nullable: true })
  feedback?: string | null;

  @ManyToOne(() => ClientCompanyEntity, {
    eager: false,
  })
  @JoinColumn({ name: 'client_company_id' })
  clientCompany: ClientCompanyEntity;

  @OneToMany(() => QuestionEntity, question => question.project)
  questions: QuestionEntity[];

  @OneToMany(() => PhotoEntity, photo => photo.project)
  photos: PhotoEntity[];

  @OneToMany(() => AdvancedPhotoEntity, advancedPhoto => advancedPhoto.project)
  advancedPhotos: AdvancedPhotoEntity[];

  @Column({ type: 'text', nullable: true, name: 'photo_image_name_pattern' })
  photoImageNamePattern?: string | null;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
