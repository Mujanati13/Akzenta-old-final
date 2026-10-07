import {
  CreateDateColumn,
  Entity,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
  ManyToOne,
  JoinColumn,
} from 'typeorm';
import { EntityRelationalHelper } from '../../../../../utils/relational-entity-helper';
import { ProjectEntity } from '../../../../../project/infrastructure/persistence/relational/entities/project.entity';
import { BranchEntity } from '../../../../../branch/infrastructure/persistence/relational/entities/branch.entity';

@Entity({
  name: 'project_branch',
})
export class ProjectBranchEntity extends EntityRelationalHelper {
  @PrimaryGeneratedColumn()
  id: number;

  @ManyToOne(() => ProjectEntity, {
    eager: true,
  })
  @JoinColumn({ name: 'project_id' })
  project: ProjectEntity;

  @ManyToOne(() => BranchEntity, {
    eager: true,
  })
  @JoinColumn({ name: 'branche_id' })
  branch: BranchEntity;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
