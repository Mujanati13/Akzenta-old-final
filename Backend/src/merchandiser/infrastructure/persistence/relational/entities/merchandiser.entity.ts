import {
  CreateDateColumn,
  Entity,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
  ManyToOne,
  JoinColumn,
  Column,
  ManyToMany,
  JoinTable,
  OneToMany,
} from 'typeorm';
import { EntityRelationalHelper } from '../../../../../utils/relational-entity-helper';
import { UserEntity } from '../../../../../users/infrastructure/persistence/relational/entities/user.entity';
import { JobTypesEntity } from '../../../../../job-types/infrastructure/persistence/relational/entities/job-types.entity';
import { CitiesEntity } from '../../../../../cities/infrastructure/persistence/relational/entities/cities.entity';
import { ContractualsEntity } from '../../../../../contractuals/infrastructure/persistence/relational/entities/contractuals.entity';
import { MerchandiserStatusEntity } from '../../../../../merchandiser-statuses/infrastructure/persistence/relational/entities/status.entity';
import { MerchandiserJobTypesEntity } from '../../../../../merchandiser-job-types/infrastructure/persistence/relational/entities/merchandiser-job-types.entity';

@Entity({
  name: 'merchandiser',
})
export class MerchandiserEntity extends EntityRelationalHelper {
  @PrimaryGeneratedColumn()
  id: number;

  @ManyToOne(() => UserEntity, {
    eager: true,
  })
  @JoinColumn({ name: 'user_id' })
  user: UserEntity;

  @Column({ type: 'date', nullable: true })
  birthday?: Date | null;

  @Column({ type: 'varchar', nullable: true })
  website?: string | null;

  @Column({ type: 'varchar', nullable: true })
  street: string;

  @Column({ type: 'varchar', nullable: false, name: 'zip_code' })
  zipCode: string;

  @Column({ type: 'varchar', nullable: true, name: 'tax_id' })
  tax_id: string;

  @Column({ type: 'varchar', nullable: true, name: 'tax_no' })
  tax_no: string;

  @ManyToOne(() => CitiesEntity)
  @JoinColumn({ name: 'city_id' })
  city: CitiesEntity;

  @Column({ type: 'varchar', nullable: true })
  nationality?: string | null;

  @Column({ type: 'varchar', nullable: true, name: 'delivery_street' })
  deliveryStreet?: string | null;

  @Column({ type: 'varchar', nullable: true, name: 'delivery_zip_code' })
  deliveryZipCode?: string | null;

  @Column({ type: 'varchar', nullable: true, name: 'delivery_country' })
  deliveryCountry?: string | null;

  @Column({ type: 'varchar', nullable: true, name: 'secondary_residence' })
  secondaryResidence?: string | null;

  @Column({ type: 'varchar', nullable: true, name: 'secondary_zip_code' })
  secondaryZipCode?: string | null;

  @Column({ type: 'varchar', nullable: true, name: 'secondary_country' })
  secondaryCountry?: string | null;
  
  @ManyToOne(() => MerchandiserStatusEntity, {
    eager: true,
    nullable: true,
  })
  status?: MerchandiserStatusEntity;

  @ManyToMany(() => ContractualsEntity, {
    eager: true,
  })
  @JoinTable({
    name: 'merchandiser_contractuals',
    joinColumn: {
      name: 'merchandiser_id',
      referencedColumnName: 'id',
    },
    inverseJoinColumn: {
      name: 'contractual_id',
      referencedColumnName: 'id',
    },
  })
  contractuals?: ContractualsEntity[];

  @OneToMany(() => MerchandiserJobTypesEntity, (mjt) => mjt.merchandiser)
  jobTypes: MerchandiserJobTypesEntity[];

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}