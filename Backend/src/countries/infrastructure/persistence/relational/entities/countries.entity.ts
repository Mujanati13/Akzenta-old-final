import {
  CreateDateColumn,
  Entity,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
  OneToMany,
  Column,
} from 'typeorm';
import { EntityRelationalHelper } from '../../../../../utils/relational-entity-helper';
import { CitiesEntity } from '../../../../../cities/infrastructure/persistence/relational/entities/cities.entity';

@Entity({
  name: 'countries',
})
export class CountriesEntity extends EntityRelationalHelper {
  @Column({
    nullable: true,
    type: String,
  })
  flag?: string | null;

  @PrimaryGeneratedColumn()
  id: number;

  @Column({ type: 'jsonb', nullable: false })
  name: Record<string, string>;

  @OneToMany(
    () => CitiesEntity,
    (childEntity: CitiesEntity) => childEntity.country,
    {
      eager: false,
      nullable: true,
    },
  )
  cities?: CitiesEntity[] | null;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
