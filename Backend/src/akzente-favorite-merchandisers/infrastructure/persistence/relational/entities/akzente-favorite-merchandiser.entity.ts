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
import { MerchandiserEntity } from '../../../../../merchandiser/infrastructure/persistence/relational/entities/merchandiser.entity';

@Entity({
  name: 'akzente_favorite_merchandisers',
})
export class AkzenteFavoriteMerchandiserEntity extends EntityRelationalHelper {
  @PrimaryGeneratedColumn()
  id: number;

  @ManyToOne(() => AkzenteEntity, {
    eager: true,
  })
  @JoinColumn({ name: 'akzente_id' })
  akzente: AkzenteEntity;

  @ManyToOne(() => MerchandiserEntity, {
    eager: true,
  })
  @JoinColumn({ name: 'merchandiser_id' })
  merchandiser: MerchandiserEntity;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}