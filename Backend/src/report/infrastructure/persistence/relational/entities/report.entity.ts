import {
  CreateDateColumn,
  Entity,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
  ManyToOne,
  JoinColumn,
  Column,
  OneToMany,
  OneToOne,
} from 'typeorm';
import { EntityRelationalHelper } from '../../../../../utils/relational-entity-helper';
import { ProjectEntity } from '../../../../../project/infrastructure/persistence/relational/entities/project.entity';
import { ClientCompanyEntity } from '../../../../../client-company/infrastructure/persistence/relational/entities/client-company.entity';
import { MerchandiserEntity } from '../../../../../merchandiser/infrastructure/persistence/relational/entities/merchandiser.entity';
import { BranchEntity } from '../../../../../branch/infrastructure/persistence/relational/entities/branch.entity';
import { StatusEntity } from '../../../../../report-status/infrastructure/persistence/relational/entities/status.entity';
import { AnswerEntity } from '../../../../../answer/infrastructure/persistence/relational/entities/answer.entity';
import { ConversationEntity } from '../../../../../conversation/infrastructure/persistence/relational/entities/conversation.entity';
import { UploadedAdvancedPhotoEntity } from '../../../../../uploaded-advanced-photos/infrastructure/persistence/relational/entities/uploaded-advanced-photo.entity';

@Entity({
  name: 'report',
})
export class ReportEntity extends EntityRelationalHelper {
  @PrimaryGeneratedColumn()
  id: number;

  @ManyToOne(() => ProjectEntity, {
    eager: true,
  })
  @JoinColumn({ name: 'project_id' })
  project: ProjectEntity;

  @ManyToOne(() => StatusEntity, {
    eager: true,
  })
  @JoinColumn({ name: 'status_id' })
  status: StatusEntity;

  @ManyToOne(() => ClientCompanyEntity, {
    eager: true,
  })
  @JoinColumn({ name: 'client_company_id' })
  clientCompany: ClientCompanyEntity;

  @ManyToOne(() => MerchandiserEntity, {
    eager: true,
    nullable: true,
  })
  @JoinColumn({ name: 'merchandiser_id' })
  merchandiser?: MerchandiserEntity | null;

  @ManyToOne(() => BranchEntity, {
    eager: true,
  })
  @JoinColumn({ name: 'branche_id' })
  branch: BranchEntity;

  @Column({ type: 'varchar', nullable: true })
  street?: string | null;

  @Column({ type: 'varchar', nullable: true, name: 'zip_code' })
  zipCode?: string | null;

  @Column({ type: 'date', nullable: true, name: 'planned_on' })
  plannedOn?: Date | null;

  @Column({ type: 'varchar', nullable: true })
  note?: string | null;

  @Column({ type: 'date', nullable: true, name: 'report_to' })
  reportTo?: Date | null;

  @Column({ type: 'date', nullable: true, name: 'visit_date' })
  visitDate?: Date | null;

  @Column({ type: 'date', nullable: true, name: 'next_visit_date' })
  nextVisitDate?: Date | null;

  @Column({ type: 'varchar', nullable: true })
  feedback?: string | null;

  @Column({ type: 'boolean', default: false })
  accepted: boolean;

  @OneToOne(() => ConversationEntity, conversation => conversation.report, { eager: true })
  conversation: ConversationEntity;

  @OneToMany(() => AnswerEntity, answer => answer.report)
  answers: AnswerEntity[];

  @OneToMany(() => UploadedAdvancedPhotoEntity, uploadedAdvancedPhoto => uploadedAdvancedPhoto.report)
  uploadedAdvancedPhotos: UploadedAdvancedPhotoEntity[];

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
