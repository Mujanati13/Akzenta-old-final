import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, In } from 'typeorm';
import { MessageEntity } from '../entities/message.entity';
import { NullableType } from '../../../../../utils/types/nullable.type';
import { Message } from '../../../../domain/message';
import { MessageRepository } from '../../message.repository';
import { MessageMapper } from '../mappers/message.mapper';
import { IPaginationOptions } from '../../../../../utils/types/pagination-options';

@Injectable()
export class MessageRelationalRepository implements MessageRepository {
  constructor(
    @InjectRepository(MessageEntity)
    private readonly messageRepository: Repository<MessageEntity>,
  ) {}

  async create(data: Omit<Message, 'id' | 'createdAt' | 'updatedAt'>): Promise<Message> {
    const persistenceModel = MessageMapper.toPersistence(data);
    
    // Set the relations
    if (data.conversationId) {
      persistenceModel.conversation = { id: data.conversationId } as any;
    }
    if (data.senderId) {
      persistenceModel.sender = { id: data.senderId } as any;
    }
    if (data.receiverId) {
      persistenceModel.receiver = { id: data.receiverId } as any;
    }
    
    const newEntity = await this.messageRepository.save(
      this.messageRepository.create(persistenceModel),
    );
    return MessageMapper.toDomain(newEntity);
  }

  async findAllWithPagination({
    paginationOptions,
  }: {
    paginationOptions: IPaginationOptions;
  }): Promise<Message[]> {
    const entities = await this.messageRepository.find({
      skip: (paginationOptions.page - 1) * paginationOptions.limit,
      take: paginationOptions.limit,
    });

    return entities.map((entity) => MessageMapper.toDomain(entity));
  }

  async findById(id: Message['id']): Promise<NullableType<Message>> {
    const entity = await this.messageRepository.findOne({
      where: { id: Number(id) },
    });

    return entity ? MessageMapper.toDomain(entity) : null;
  }

  async findByIds(ids: Message['id'][]): Promise<Message[]> {
    const entities = await this.messageRepository.find({
      where: { id: In(ids) },
    });

    return entities.map((entity) => MessageMapper.toDomain(entity));
  }

  async findByConversationId(conversationId: number): Promise<Message[]> {
    const entities = await this.messageRepository.find({
      where: { conversation: { id: conversationId } },
      order: { createdAt: 'ASC' },
    });

    return entities.map((entity) => MessageMapper.toDomain(entity));
  }

  async update(id: Message['id'], payload: Partial<Message>): Promise<Message> {
    const entity = await this.messageRepository.findOne({
      where: { id: Number(id) },
    });

    if (!entity) {
      throw new Error('Message not found');
    }

    const updateData = { ...MessageMapper.toDomain(entity), ...payload };
    const persistenceModel = MessageMapper.toPersistence(updateData);
    
    // Set the relations if provided
    if (payload.conversationId) {
      persistenceModel.conversation = { id: payload.conversationId } as any;
    }
    if (payload.senderId) {
      persistenceModel.sender = { id: payload.senderId } as any;
    }
    if (payload.receiverId) {
      persistenceModel.receiver = { id: payload.receiverId } as any;
    }

    const updatedEntity = await this.messageRepository.save(
      this.messageRepository.create({
        ...entity,
        ...persistenceModel,
      }),
    );

    return MessageMapper.toDomain(updatedEntity);
  }

  async remove(id: Message['id']): Promise<void> {
    await this.messageRepository.softDelete(id);
  }
}