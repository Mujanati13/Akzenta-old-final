import { CountriesEntity } from '../../../../../countries/infrastructure/persistence/relational/entities/countries.entity';

import {
  CreateDateColumn,
  Entity,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
  ManyToOne,
  Column,
  OneToMany,
} from 'typeorm';
import { EntityRelationalHelper } from '../../../../../utils/relational-entity-helper';
import { MerchandiserEntity } from '../../../../../merchandiser/infrastructure/persistence/relational/entities/merchandiser.entity';

@Entity({
  name: 'cities',
})
export class CitiesEntity extends EntityRelationalHelper {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({
    nullable: false,
    type: String,
  })
  name: string;

  @Column({
    type: 'float8',
    array: true,
    nullable: false,
  })
  coordinates: [number, number];

  @ManyToOne(() => CountriesEntity, (parentEntity) => parentEntity.cities, {
    eager: true, // Change to eager loading for country
    nullable: false,
  })
  country: CountriesEntity;

  @OneToMany(() => MerchandiserEntity, (childEntity) => childEntity.city, {
    eager: false,
    nullable: false,
  })
  merchandisers: MerchandiserEntity[];

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}