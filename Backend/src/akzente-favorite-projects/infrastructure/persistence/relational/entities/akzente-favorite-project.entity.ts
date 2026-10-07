import {
  CreateDateColumn,
  Entity,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
  ManyToOne,
  JoinColumn,
} from 'typeorm';
import { EntityRelationalHelper } from '../../../../../utils/relational-entity-helper';
import { AkzenteEntity } from '../../../../../akzente/infrastructure/persistence/relational/entities/akzente.entity';
import { ProjectEntity } from '../../../../../project/infrastructure/persistence/relational/entities/project.entity';

@Entity({
  name: 'akzente_favorite_projects',
})
export class AkzenteFavoriteProjectEntity extends EntityRelationalHelper {
  @PrimaryGeneratedColumn()
  id: number;

  @ManyToOne(() => AkzenteEntity, {
    eager: true,
  })
  @JoinColumn({ name: 'akzente_id' })
  akzente: AkzenteEntity;

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