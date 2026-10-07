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
import { MerchandiserFileType } from '../../../../domain/merchandiser-files';
import { MerchandiserEntity } from '../../../../../merchandiser/infrastructure/persistence/relational/entities/merchandiser.entity';
import { FileEntity } from '../../../../../files/infrastructure/persistence/relational/entities/file.entity';

@Entity({
  name: 'merchandiser_files',
})
export class MerchandiserFilesEntity extends EntityRelationalHelper {
  @PrimaryGeneratedColumn()
  id: number;

  @ManyToOne(() => MerchandiserEntity, {
    eager: false,
  })
  @JoinColumn({ name: 'merchandiser_id' })
  merchandiser: MerchandiserEntity;

  @ManyToOne(() => FileEntity, {
    eager: true,
  })
  @JoinColumn({ name: 'file_id' })
  file: FileEntity;

  @Column({
    type: 'enum',
    enum: MerchandiserFileType,
    nullable: true,
  })
  type: MerchandiserFileType | null;

  @Column({
    type: 'varchar',
    length: 255,
    nullable: true,
  })
  name: string | null;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}