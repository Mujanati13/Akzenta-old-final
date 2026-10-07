import {
  Column,
  CreateDateColumn,
  Entity,
  ManyToOne,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
  JoinColumn,
} from 'typeorm';
import { EntityRelationalHelper } from '../../../../../utils/relational-entity-helper';
import { ClientEntity } from '../../../../../client/infrastructure/persistence/relational/entities/client.entity';

@Entity({
  name: 'support_mails',
})
export class SupportMailEntity extends EntityRelationalHelper {
  @PrimaryGeneratedColumn()
  id: number;

  @ManyToOne(() => ClientEntity, {
    eager: true,
  })
  @JoinColumn({ name: 'client_id' })
  client: ClientEntity;

  @Column({ type: String })
  subject: string;

  @Column({ type: 'text' })
  content: string;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}

