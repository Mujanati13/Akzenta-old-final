import { Injectable } from '@nestjs/common';
import { CreateNotificationDto } from './dto/create-notification.dto';
import { UpdateNotificationDto } from './dto/update-notification.dto';
import { NullableType } from '../utils/types/nullable.type';
import { FilterNotificationDto, SortNotificationDto } from './dto/query-notification.dto';
import { NotificationRepository } from './infrastructure/persistence/notification.repository';
import { Notification } from './domain/notification';
import { IPaginationOptions } from '../utils/types/pagination-options';
import { User } from '../users/domain/user';

@Injectable()
export class NotificationsService {
  constructor(
    private readonly notificationsRepository: NotificationRepository,
  ) {}

  async create(createNotificationDto: CreateNotificationDto): Promise<Notification> {
    return this.notificationsRepository.create({
      message: createNotificationDto.message,
      seen: createNotificationDto.seen ?? false,
      link: createNotificationDto.link,
      user: createNotificationDto.user as User,
    });
  }

  findManyWithPagination({
    filterOptions,
    sortOptions,
    paginationOptions,
  }: {
    filterOptions?: FilterNotificationDto | null;
    sortOptions?: SortNotificationDto[] | null;
    paginationOptions: IPaginationOptions;
  }): Promise<Notification[]> {
    return this.notificationsRepository.findManyWithPagination({
      filterOptions,
      sortOptions,
      paginationOptions,
    });
  }

  findById(id: Notification['id']): Promise<NullableType<Notification>> {
    return this.notificationsRepository.findById(id);
  }

  findByUserId(userId: User['id']): Promise<Notification[]> {
    return this.notificationsRepository.findByUserId(userId);
  }

  findByScope(userId: User['id'], userType?: string): Promise<Notification[]> {
    void userType;
    return this.notificationsRepository.findByUserId(userId);
  }

  findUnseenByUserId(userId: User['id']): Promise<Notification[]> {
    return this.notificationsRepository.findUnseenByUserId(userId);
  }

  findUnseenByScope(userId: User['id'], userType?: string): Promise<Notification[]> {
    void userType;
    return this.notificationsRepository.findUnseenByUserId(userId);
  }

  async update(
    id: Notification['id'],
    updateNotificationDto: UpdateNotificationDto,
  ): Promise<Notification | null> {
    return this.notificationsRepository.update(id, updateNotificationDto);
  }

  async markAsSeen(id: Notification['id']): Promise<Notification | null> {
    return this.notificationsRepository.markAsSeen(id);
  }

  async markAllAsSeenByUserId(userId: User['id']): Promise<void> {
    return this.notificationsRepository.markAllAsSeenByUserId(userId);
  }

  async markAllAsSeenByScope(userId: User['id'], userType?: string): Promise<void> {
    void userType;
    return this.notificationsRepository.markAllAsSeenByUserId(userId);
  }

  async markAllAsSeenByConversationId(conversationId: number, userId: User['id']): Promise<void> {
    return this.notificationsRepository.markAllAsSeenByConversationId(conversationId, userId);
  }

  async markAllAsSeenByConversationScope(
    conversationId: number,
    userId: User['id'],
    userType?: string,
  ): Promise<void> {
    void userType;
    return this.notificationsRepository.markAllAsSeenByConversationId(
      conversationId,
      userId,
    );
  }

  async toggleSeen(id: Notification['id']): Promise<Notification | null> {
    return this.notificationsRepository.toggleSeen(id);
  }

  async toggleConversationSeen(
    conversationId: number,
    userId: User['id'],
    userType?: string,
  ): Promise<void> {
    // Find a notification from this conversation to check current state
    void userType;
    const notification = await this.notificationsRepository.findByConversationAndUser(
      conversationId,
      userId,
    );
    
    if (notification) {
      // Toggle all notifications from this conversation to the opposite state
      const newSeenState = !notification.seen;
      
      if (newSeenState) {
        await this.notificationsRepository.markAllAsSeenByConversationId(
          conversationId,
          userId,
        );
      } else {
        await this.notificationsRepository.markAllAsUnseenByConversationId(
          conversationId,
          userId,
        );
      }
    }
  }

  async createMessageNotification(data: {
    receiverId: number;
    senderName: string;
    projectName: string;
    reportId: number;
    conversationId: number;
    link: string;
  }): Promise<Notification> {
    const { receiverId, senderName, projectName, conversationId, link } = data;
    
    // Check if a notification already exists for this conversation and user
    const existingNotification = await this.notificationsRepository.findByConversationAndUser(
      conversationId,
      receiverId
    );
    
    // If exists, remove it first
    if (existingNotification) {
      await this.notificationsRepository.removeByConversationAndUser(conversationId, receiverId);
    }
    
    // Format the notification message
    const currentDate = new Date().toLocaleDateString('de-DE', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric'
    });
    
    const message = `Am ${currentDate} hat ${senderName} einen Kommentar zum Einsatz ${projectName} eingegeben.`;
    
    const notification = new Notification({
      message,
      seen: false,
      link,
      user: { id: receiverId } as User,
      conversation: { id: conversationId } as any,
    });
    
    return this.notificationsRepository.create(notification);
  }

  async remove(id: Notification['id']): Promise<void> {
    await this.notificationsRepository.remove(id);
  }
}