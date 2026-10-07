import {
  CreateDateColumn,
  Entity,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
  ManyToOne,
  JoinColumn,
} from 'typeorm';
import { EntityRelationalHelper } from '../../../../../utils/relational-entity-helper';
import { ClientEntity } from '../../../../../client/infrastructure/persistence/relational/entities/client.entity';
import { ProjectEntity } from '../../../../../project/infrastructure/persistence/relational/entities/project.entity';

@Entity({
  name: 'client_favorite_projects',
})
export class ClientFavoriteProjectEntity extends EntityRelationalHelper {
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