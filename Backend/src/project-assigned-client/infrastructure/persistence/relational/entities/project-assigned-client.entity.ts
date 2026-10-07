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
import { ProjectEntity } from '../../../../../project/infrastructure/persistence/relational/entities/project.entity';
import { ClientEntity } from '../../../../../client/infrastructure/persistence/relational/entities/client.entity';

@Entity({
  name: 'project_assigned_client',
})
export class ProjectAssignedClientEntity extends EntityRelationalHelper {
  @PrimaryGeneratedColumn()
  id: number;

  @ManyToOne(() => ClientEntity, {
    eager: true,
  })
  @JoinColumn({ name: 'client_id' })
  client: ClientEntity;

  @ManyToOne(() => ProjectEntity, {
    eager: true,
  })
  @JoinColumn({ name: 'project_id' })
  project: ProjectEntity;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
