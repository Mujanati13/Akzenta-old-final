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
import { ConversationEntity } from '../../../../../conversation/infrastructure/persistence/relational/entities/conversation.entity';
import { UserEntity } from '../../../../../users/infrastructure/persistence/relational/entities/user.entity';

@Entity({
  name: 'message',
})
export class MessageEntity extends EntityRelationalHelper {
  @PrimaryGeneratedColumn()
  id: number;

  @ManyToOne(() => ConversationEntity, {
    eager: true,
  })
  @JoinColumn({ name: 'conversation_id' })
  conversation: ConversationEntity;

  @ManyToOne(() => UserEntity, {
    eager: true,
  })
  @JoinColumn({ name: 'sender_id' })
  sender: UserEntity;

  @ManyToOne(() => UserEntity, {
    eager: true,
  })
  @JoinColumn({ name: 'receiver_id' })
  receiver: UserEntity;

  @Column({ 
    name: 'content',
    type: 'varchar'
  })
  content: string;

  @Column({ 
    name: 'seen',
    type: 'boolean',
    default: false
  })
  seen: boolean;

  @Column({ 
    name: 'receiver_type',
    type: 'enum',
    enum: ['akzente', 'client', 'merchandiser'],
    nullable: true
  })
  receiverType: string | null;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}