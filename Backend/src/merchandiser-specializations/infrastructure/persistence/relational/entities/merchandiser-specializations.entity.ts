import {
  CreateDateColumn,
  Entity,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';
import { EntityRelationalHelper } from '../../../../../utils/relational-entity-helper';
import { MerchandiserEntity } from '../../../../../merchandiser/infrastructure/persistence/relational/entities/merchandiser.entity';
import { SpecializationsEntity } from '../../../../../specializations/infrastructure/persistence/relational/entities/specializations.entity';

@Entity({
  name: 'merchandiser_specializations',
})
export class MerchandiserSpecializationsEntity extends EntityRelationalHelper {
  @PrimaryGeneratedColumn()
  id: number;

  @ManyToOne(() => MerchandiserEntity, {
    eager: true,
  })
  @JoinColumn({ name: 'merchandiser_id' })
  merchandiser: MerchandiserEntity;

  @ManyToOne(() => SpecializationsEntity, {
    eager: true,
  })
  @JoinColumn({ name: 'specializations_id' })
  specialization: SpecializationsEntity;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}