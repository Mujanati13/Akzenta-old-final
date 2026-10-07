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
import { LanguagesEntity } from '../../../../../languages/infrastructure/persistence/relational/entities/languages.entity';
import { LanguageLevel } from '../../../../domain/merchandiser-languages';

@Entity({
  name: 'merchandiser_languages',
})
export class MerchandiserLanguagesEntity extends EntityRelationalHelper {
  @PrimaryGeneratedColumn()
  id: number;

  @ManyToOne(() => MerchandiserEntity, {
    eager: true,
  })
  @JoinColumn({ name: 'merchandiser_id' })
  merchandiser: MerchandiserEntity;

  @ManyToOne(() => LanguagesEntity, {
    eager: true,
  })
  @JoinColumn({ name: 'languages_id' })
  language: LanguagesEntity;

  @Column({
    type: 'enum',
    enum: LanguageLevel,
  })
  level: LanguageLevel;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}