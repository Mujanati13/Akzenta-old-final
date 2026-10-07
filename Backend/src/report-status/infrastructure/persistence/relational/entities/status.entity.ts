import {
  CreateDateColumn,
  Entity,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
  Column,
} from 'typeorm';
import { EntityRelationalHelper } from '../../../../../utils/relational-entity-helper';

@Entity({
  name: 'report-status',
})
export class StatusEntity extends EntityRelationalHelper {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ type: 'varchar', nullable: false })
  name: string;

  @Column({ type: 'varchar', nullable: true })
  akzenteName?: string | null;

  @Column({ type: 'varchar', nullable: true })
  clientName?: string | null;

  @Column({ type: 'varchar', nullable: true })
  merchandiserName?: string | null;

  @Column({ type: 'varchar', nullable: true })
  akzenteColor?: string | null;

  @Column({ type: 'varchar', nullable: true })
  clientColor?: string | null;

  @Column({ type: 'varchar', nullable: true })
  merchandiserColor?: string | null;
}
