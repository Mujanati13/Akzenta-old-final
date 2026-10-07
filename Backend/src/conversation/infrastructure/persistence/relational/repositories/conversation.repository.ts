import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, In } from 'typeorm';
import { ConversationEntity } from '../entities/conversation.entity';
import { NullableType } from '../../../../../utils/types/nullable.type';
import { Conversation } from '../../../../domain/conversation';
import { ConversationRepository } from '../../conversation.repository';
import { ConversationMapper } from '../mappers/conversation.mapper';
import { IPaginationOptions } from '../../../../../utils/types/pagination-options';

@Injectable()
export class ConversationRelationalRepository implements ConversationRepository {
  constructor(
    @InjectRepository(ConversationEntity)
    private readonly conversationRepository: Repository<ConversationEntity>,
  ) {}

  async create(data: Omit<Conversation, 'id' | 'createdAt' | 'updatedAt'>): Promise<Conversation> {
    const persistenceModel = ConversationMapper.toPersistence(data);
    
    // Set the report relation
    if (data.reportId) {
      persistenceModel.report = { id: data.reportId } as any;
    }
    
    const newEntity = await this.conversationRepository.save(
      this.conversationRepository.create(persistenceModel),
    );
    return ConversationMapper.toDomain(newEntity);
  }

  async findAllWithPagination({
    paginationOptions,
  }: {
    paginationOptions: IPaginationOptions;
  }): Promise<Conversation[]> {
    const entities = await this.conversationRepository.find({
      skip: (paginationOptions.page - 1) * paginationOptions.limit,
      take: paginationOptions.limit,
    });

    return entities.map((entity) => ConversationMapper.toDomain(entity));
  }

  async findById(id: Conversation['id']): Promise<NullableType<Conversation>> {
    const entity = await this.conversationRepository.findOne({
      where: { id: Number(id) },
    });

    return entity ? ConversationMapper.toDomain(entity) : null;
  }

  async findByIds(ids: Conversation['id'][]): Promise<Conversation[]> {
    const entities = await this.conversationRepository.find({
      where: { id: In(ids) },
    });

    return entities.map((entity) => ConversationMapper.toDomain(entity));
  }

  async update(id: Conversation['id'], payload: Partial<Conversation>): Promise<Conversation> {
    const entity = await this.conversationRepository.findOne({
      where: { id: Number(id) },
    });

    if (!entity) {
      throw new Error('Conversation not found');
    }

    const updateData = { ...ConversationMapper.toDomain(entity), ...payload };
    const persistenceModel = ConversationMapper.toPersistence(updateData);
    
    // Set the report relation if reportId is provided
    if (payload.reportId) {
      persistenceModel.report = { id: payload.reportId } as any;
    }

    const updatedEntity = await this.conversationRepository.save(
      this.conversationRepository.create({
        ...entity,
        ...persistenceModel,
      }),
    );

    return ConversationMapper.toDomain(updatedEntity);
  }

  async remove(id: Conversation['id']): Promise<void> {
    await this.conversationRepository.softDelete(id);
  }
}