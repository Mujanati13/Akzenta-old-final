import {
  Column,
  CreateDateColumn,
  DeleteDateColumn,
  Entity,
  Index,
  ManyToOne,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';
import { UserEntity } from '../../../../../users/infrastructure/persistence/relational/entities/user.entity';
import { EntityRelationalHelper } from '../../../../../utils/relational-entity-helper';
import { ConversationEntity } from '../../../../../conversation/infrastructure/persistence/relational/entities/conversation.entity';

@Entity({
  name: 'notification',
})
export class NotificationEntity extends EntityRelationalHelper {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ type: 'text' })
  message: string;

  @Column({ type: 'boolean', default: false })
  @Index()
  seen: boolean;

  @Column({ type: String, nullable: true })
  link?: string | null;

  @ManyToOne(() => UserEntity, {
    eager: false,
  })
  @Index()
  user: UserEntity;

  @ManyToOne(() => ConversationEntity, {
    eager: false,
    nullable: true,
  })
  @Index()
  conversation?: ConversationEntity | null;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;

  @DeleteDateColumn()
  deletedAt: Date;
}