import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { FindOptionsWhere, In, Repository } from 'typeorm';
import { NotificationEntity } from '../entities/notification.entity';
import { NullableType } from '../../../../../utils/types/nullable.type';
import { FilterNotificationDto, SortNotificationDto } from '../../../../dto/query-notification.dto';
import { Notification } from '../../../../domain/notification';
import { NotificationRepository } from '../../notification.repository';
import { NotificationMapper } from '../mappers/notification.mapper';
import { IPaginationOptions } from '../../../../../utils/types/pagination-options';
import { User } from '../../../../../users/domain/user';

@Injectable()
export class NotificationsRelationalRepository implements NotificationRepository {
  constructor(
    @InjectRepository(NotificationEntity)
    private readonly notificationsRepository: Repository<NotificationEntity>,
  ) {}

  async create(data: Notification): Promise<Notification> {
    // Create entity directly without mapper to avoid ID conflicts
    const newEntity = this.notificationsRepository.create({
      message: data.message,
      seen: data.seen,
      link: data.link,
      user: { id: Number(data.user.id) } as any,
      conversation: data.conversation ? { id: Number(data.conversation.id) } as any : null,
    });
    
    const savedEntity = await this.notificationsRepository.save(newEntity);
    
    // Fetch the created entity with relations to return complete data
    const createdEntity = await this.notificationsRepository.findOne({
      where: { id: savedEntity.id },
      relations: ['conversation', 'conversation.report'],
    });
    
    return NotificationMapper.toDomain(createdEntity!);
  }

  async findManyWithPagination({
    filterOptions,
    sortOptions,
    paginationOptions,
  }: {
    filterOptions?: FilterNotificationDto | null;
    sortOptions?: SortNotificationDto[] | null;
    paginationOptions: IPaginationOptions;
  }): Promise<Notification[]> {
    const where: FindOptionsWhere<NotificationEntity> = {};
    
    if (filterOptions?.user?.id) {
      where.user = { id: Number(filterOptions.user.id) };
    }
    
    if (filterOptions?.seen !== undefined && filterOptions.seen !== null) {
      where.seen = filterOptions.seen;
    }

    const entities = await this.notificationsRepository.find({
      skip: (paginationOptions.page - 1) * paginationOptions.limit,
      take: paginationOptions.limit,
      where: where,
      relations: ['conversation', 'conversation.report'],
      order: sortOptions?.reduce(
        (accumulator, sort) => ({
          ...accumulator,
          [sort.orderBy]: sort.order,
        }),
        {},
      ) || { createdAt: 'DESC' },
    });

    return entities.map((notification) => NotificationMapper.toDomain(notification));
  }

  async findById(id: Notification['id']): Promise<NullableType<Notification>> {
    const entity = await this.notificationsRepository.findOne({
      where: { id: Number(id) },
      relations: ['conversation', 'conversation.report'],
    });

    return entity ? NotificationMapper.toDomain(entity) : null;
  }

  async findByUserId(userId: User['id']): Promise<Notification[]> {
    const entities = await this.notificationsRepository.find({
      where: { user: { id: Number(userId) } },
      relations: ['conversation', 'conversation.report'],
      order: { createdAt: 'DESC' },
    });

    return entities.map((notification) => NotificationMapper.toDomain(notification));
  }

  async findUnseenByUserId(userId: User['id']): Promise<Notification[]> {
    const entities = await this.notificationsRepository.find({
      where: { 
        user: { id: Number(userId) },
        seen: false 
      },
      relations: ['conversation', 'conversation.report'],
      order: { createdAt: 'DESC' },
    });

    return entities.map((notification) => NotificationMapper.toDomain(notification));
  }

  async findByRecipientUserType(userTypeName: string): Promise<Notification[]> {
    const entities = await this.notificationsRepository.find({
      where: {
        user: {
          type: { name: userTypeName },
        },
      },
      relations: ['conversation', 'conversation.report'],
      order: { createdAt: 'DESC' },
    });

    return entities.map((notification) => NotificationMapper.toDomain(notification));
  }

  async findUnseenByRecipientUserType(userTypeName: string): Promise<Notification[]> {
    const entities = await this.notificationsRepository.find({
      where: {
        user: {
          type: { name: userTypeName },
        },
        seen: false,
      },
      relations: ['conversation', 'conversation.report'],
      order: { createdAt: 'DESC' },
    });

    return entities.map((notification) => NotificationMapper.toDomain(notification));
  }

  async update(id: Notification['id'], payload: Partial<Notification>): Promise<Notification> {
    const entity = await this.notificationsRepository.findOne({
      where: { id: Number(id) },
    });

    if (!entity) {
      throw new Error('Notification not found');
    }

    const updatedEntity = await this.notificationsRepository.save(
      this.notificationsRepository.create(
        NotificationMapper.toPersistence({
          ...NotificationMapper.toDomain(entity),
          ...payload,
        }),
      ),
    );

    return NotificationMapper.toDomain(updatedEntity);
  }

  async markAsSeen(id: Notification['id']): Promise<Notification | null> {
    return this.update(id, { seen: true });
  }

  async markAllAsSeenByUserId(userId: User['id']): Promise<void> {
    await this.notificationsRepository.update(
      { user: { id: Number(userId) } },
      { seen: true }
    );
  }

  async markAllAsSeenByRecipientUserType(userTypeName: string): Promise<void> {
    const notificationIds = await this.notificationsRepository
      .createQueryBuilder('notification')
      .leftJoin('notification.user', 'user')
      .leftJoin('user.type', 'userType')
      .where('LOWER(userType.name) = LOWER(:userTypeName)', { userTypeName })
      .select('notification.id', 'id')
      .getRawMany<{ id: number }>();

    if (notificationIds.length === 0) {
      return;
    }

    await this.notificationsRepository.update(
      { id: In(notificationIds.map((item) => item.id)) },
      { seen: true },
    );
  }

  async markAllAsSeenByConversationId(
    conversationId: number,
    userId: User['id'],
  ): Promise<void> {
    await this.notificationsRepository.update(
      {
        user: { id: Number(userId) },
        conversation: { id: conversationId },
      },
      { seen: true },
    );
  }

  async markAllAsSeenByConversationAndRecipientUserType(
    conversationId: number,
    userTypeName: string,
  ): Promise<void> {
    const notificationIds = await this.notificationsRepository
      .createQueryBuilder('notification')
      .leftJoin('notification.user', 'user')
      .leftJoin('user.type', 'userType')
      .leftJoin('notification.conversation', 'conversation')
      .where('conversation.id = :conversationId', { conversationId })
      .andWhere('LOWER(userType.name) = LOWER(:userTypeName)', {
        userTypeName,
      })
      .select('notification.id', 'id')
      .getRawMany<{ id: number }>();

    if (notificationIds.length === 0) {
      return;
    }

    await this.notificationsRepository.update(
      { id: In(notificationIds.map((item) => item.id)) },
      { seen: true },
    );
  }

  async markAllAsUnseenByConversationId(
    conversationId: number,
    userId: User['id'],
  ): Promise<void> {
    await this.notificationsRepository.update(
      {
        user: { id: Number(userId) },
        conversation: { id: conversationId },
      },
      { seen: false },
    );
  }

  async markAllAsUnseenByConversationAndRecipientUserType(
    conversationId: number,
    userTypeName: string,
  ): Promise<void> {
    const notificationIds = await this.notificationsRepository
      .createQueryBuilder('notification')
      .leftJoin('notification.user', 'user')
      .leftJoin('user.type', 'userType')
      .leftJoin('notification.conversation', 'conversation')
      .where('conversation.id = :conversationId', { conversationId })
      .andWhere('LOWER(userType.name) = LOWER(:userTypeName)', {
        userTypeName,
      })
      .select('notification.id', 'id')
      .getRawMany<{ id: number }>();

    if (notificationIds.length === 0) {
      return;
    }

    await this.notificationsRepository.update(
      { id: In(notificationIds.map((item) => item.id)) },
      { seen: false },
    );
  }

  async findByConversationAndUser(
    conversationId: number,
    userId: User['id'],
  ): Promise<Notification | null> {
    const entity = await this.notificationsRepository.findOne({
      where: {
        user: { id: Number(userId) },
        conversation: { id: conversationId },
      },
      relations: ['conversation', 'conversation.report'],
      order: { createdAt: 'DESC' },
    });

    return entity ? NotificationMapper.toDomain(entity) : null;
  }

  async findByConversationAndRecipientUserType(
    conversationId: number,
    userTypeName: string,
  ): Promise<Notification | null> {
    const entity = await this.notificationsRepository.findOne({
      where: {
        conversation: { id: conversationId },
        user: {
          type: { name: userTypeName },
        },
      },
      relations: ['conversation', 'conversation.report'],
      order: { createdAt: 'DESC' },
    });

    return entity ? NotificationMapper.toDomain(entity) : null;
  }

  async toggleSeen(id: Notification['id']): Promise<Notification | null> {
    const entity = await this.notificationsRepository.findOne({
      where: { id: Number(id) },
    });

    if (!entity) {
      return null;
    }

    entity.seen = !entity.seen;
    const updatedEntity = await this.notificationsRepository.save(entity);
    
    const result = await this.notificationsRepository.findOne({
      where: { id: updatedEntity.id },
      relations: ['conversation', 'conversation.report'],
    });

    return result ? NotificationMapper.toDomain(result) : null;
  }

  async removeByConversationAndUser(
    conversationId: number,
    userId: User['id'],
  ): Promise<void> {
    await this.notificationsRepository.delete({
      user: { id: Number(userId) },
      conversation: { id: conversationId },
    });
  }

  async remove(id: Notification['id']): Promise<void> {
    await this.notificationsRepository.softDelete(id);
  }
}