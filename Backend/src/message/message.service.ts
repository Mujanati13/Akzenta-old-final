import { Injectable } from '@nestjs/common';
import { CreateMessageDto } from './dto/create-message.dto';
import { UpdateMessageDto } from './dto/update-message.dto';
import { MessageRepository } from './infrastructure/persistence/message.repository';
import { IPaginationOptions } from '../utils/types/pagination-options';
import { Message } from './domain/message';

@Injectable()
export class MessageService {
  constructor(
    private readonly messageRepository: MessageRepository,
  ) {}

  async create(createMessageDto: CreateMessageDto): Promise<Message> {
    return this.messageRepository.create({
      conversationId: createMessageDto.conversationId,
      senderId: createMessageDto.senderId,
      receiverId: createMessageDto.receiverId,
      content: createMessageDto.content,
      seen: createMessageDto.seen ?? false,
      receiverTypeString: createMessageDto.receiverType ?? null,
    });
  }

  findAllWithPagination({
    paginationOptions,
  }: {
    paginationOptions: IPaginationOptions;
  }) {
    return this.messageRepository.findAllWithPagination({
      paginationOptions: {
        page: paginationOptions.page,
        limit: paginationOptions.limit,
      },
    });
  }

  findById(id: Message['id']) {
    return this.messageRepository.findById(id);
  }

  findByIds(ids: Message['id'][]) {
    return this.messageRepository.findByIds(ids);
  }

  findByConversationId(conversationId: number) {
    return this.messageRepository.findByConversationId(conversationId);
  }

  async update(id: Message['id'], updateMessageDto: UpdateMessageDto) {
    return this.messageRepository.update(id, {
      conversationId: updateMessageDto.conversationId,
      senderId: updateMessageDto.senderId,
      receiverId: updateMessageDto.receiverId,
      content: updateMessageDto.content,
      seen: updateMessageDto.seen,
      receiverTypeString: updateMessageDto.receiverType ?? null,
    });
  }

  remove(id: Message['id']) {
    return this.messageRepository.remove(id);
  }
}