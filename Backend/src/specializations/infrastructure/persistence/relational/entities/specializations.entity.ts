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
import { JobTypesEntity } from '../../../../../job-types/infrastructure/persistence/relational/entities/job-types.entity';

@Entity({
  name: 'specializations',
})
export class SpecializationsEntity extends EntityRelationalHelper {
  @PrimaryGeneratedColumn()
  id: number;

  @ManyToOne(() => JobTypesEntity, {
    eager: true,
  })
  @JoinColumn({ name: 'job_types_id' })
  jobType: JobTypesEntity;

  @Column()
  name: string;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}