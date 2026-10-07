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
import { MerchandiserEntity } from '../../../../../merchandiser/infrastructure/persistence/relational/entities/merchandiser.entity';
import { JobTypesEntity } from '../../../../../job-types/infrastructure/persistence/relational/entities/job-types.entity';

@Entity({
  name: 'merchandiser_job_types',
})
export class MerchandiserJobTypesEntity extends EntityRelationalHelper {
  @PrimaryGeneratedColumn()
  id: number;

  @ManyToOne(() => MerchandiserEntity, {
    eager: true,
  })
  @JoinColumn({ name: 'merchandiser_id' })
  merchandiser: MerchandiserEntity;

  @ManyToOne(() => JobTypesEntity, {
    eager: true,
  })
  @JoinColumn({ name: 'job_type_id' })
  jobType: JobTypesEntity;

  @Column({ type: 'varchar', nullable: true })
  comment?: string | null;
}