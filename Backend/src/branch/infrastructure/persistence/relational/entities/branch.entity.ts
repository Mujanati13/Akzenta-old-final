import {
  CreateDateColumn,
  Entity,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
  ManyToOne,
  JoinColumn,
  Column,
} from 'typeorm';
import { EntityRelationalHelper } from '../../../../../utils/relational-entity-helper';
import { ClientCompanyEntity } from '../../../../../client-company/infrastructure/persistence/relational/entities/client-company.entity';
import { CitiesEntity } from '../../../../../cities/infrastructure/persistence/relational/entities/cities.entity';

@Entity({
  name: 'branche',
})
export class BranchEntity extends EntityRelationalHelper {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ type: 'varchar', nullable: false })
  name: string;

  @Column({ type: 'varchar', nullable: true, name: 'branch_number' })
  branchNumber?: string | null;

  @Column({ type: 'varchar', nullable: true })
  street?: string | null;

  @Column({ type: 'varchar', nullable: true })
  zipCode?: string | null;

  @Column({ type: String, nullable: true })
  phone?: string | null;

  @ManyToOne(() => ClientCompanyEntity, {
    eager: true,
  })
  @JoinColumn({ name: 'client_id' })
  client: ClientCompanyEntity;

  @ManyToOne(() => CitiesEntity, {
    nullable: true,
  })
  @JoinColumn({ name: 'city_id' })
  city?: CitiesEntity | null;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
