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

@Entity({
  name: 'merchandiser_references',
})
export class MerchandiserReferencesEntity extends EntityRelationalHelper {
  @PrimaryGeneratedColumn()
  id: number;

  @ManyToOne(() => MerchandiserEntity, {
    eager: true,
  })
  @JoinColumn({ name: 'merchandiser_id' })
  merchandiser: MerchandiserEntity;

  @Column()
  company: string;

  @Column()
  activity: string;

  @Column()
  branche: string;

  @Column({ name: 'start_date', type: 'date', nullable: true })
  startDate: Date | null;

  @Column({ name: 'end_date', type: 'date', nullable: true })
  endDate: Date | null;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}