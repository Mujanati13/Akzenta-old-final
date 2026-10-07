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
  name: 'merchandiser_education',
})
export class MerchandiserEducationEntity extends EntityRelationalHelper {
  @PrimaryGeneratedColumn()
  id: number;

  @ManyToOne(() => MerchandiserEntity, {
    eager: false,
  })
  @JoinColumn({ name: 'merchandiser_id' })
  merchandiser: MerchandiserEntity;

  @Column()
  company: string;

  @Column()
  activity: string;

  @Column({
    type: 'date',
    nullable: true,
  })
  graduationDate: Date | null;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}