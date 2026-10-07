import {
  Controller,
  Get,
  Post,
  Body,
  Patch,
  Param,
  Delete,
  UseGuards,
  Query,
  HttpStatus,
  HttpCode,
  SerializeOptions,
  Request,
  UnauthorizedException,
  Logger,
} from '@nestjs/common';
import { CreateNotificationDto } from './dto/create-notification.dto';
import { UpdateNotificationDto } from './dto/update-notification.dto';
import {
  ApiBearerAuth,
  ApiCreatedResponse,
  ApiOkResponse,
  ApiParam,
  ApiTags,
} from '@nestjs/swagger';
import { Roles } from '../roles/roles.decorator';
import { RoleEnum } from '../roles/roles.enum';
import { AuthGuard } from '@nestjs/passport';
import {
  InfinityPaginationResponse,
  InfinityPaginationResponseDto,
} from '../utils/dto/infinity-pagination-response.dto';
import { NullableType } from '../utils/types/nullable.type';
import { QueryNotificationDto } from './dto/query-notification.dto';
import { Notification } from './domain/notification';
import { NotificationsService } from './notifications.service';
import { RolesGuard } from '../roles/roles.guard';
import { infinityPagination } from '../utils/infinity-pagination';
import { SessionCheckGuard } from '../roles/session-check.guard';
import { User } from '../users/domain/user';

@ApiBearerAuth()
@UseGuards(AuthGuard('jwt'), SessionCheckGuard)
@ApiTags('Notifications')
@Controller({
  path: 'notifications',
  version: '1',
})
export class NotificationsController {
  constructor(private readonly notificationsService: NotificationsService) {}
  private readonly logger = new Logger(NotificationsController.name);

  private getAuthenticatedUserId(request: any): number {
    const rawUserId = request?.user?.id ?? request?.user?.sub;
    const userId = Number(rawUserId);

    if (!Number.isFinite(userId) || userId <= 0) {
      throw new UnauthorizedException('Invalid authenticated user');
    }

    return userId;
  }

  private getAuthenticatedUserType(request: any): string | undefined {
    return request?.user?.userType || request?.user?.type?.name;
  }

  @ApiCreatedResponse({
    type: Notification,
  })
  @Roles(RoleEnum.admin)
  @UseGuards(RolesGuard)
  @Post()
  @HttpCode(HttpStatus.CREATED)
  create(@Body() createNotificationDto: CreateNotificationDto): Promise<Notification> {
    return this.notificationsService.create(createNotificationDto);
  }

  @ApiOkResponse({
    type: InfinityPaginationResponse(Notification),
  })
  @Roles(RoleEnum.admin)
  @UseGuards(RolesGuard)
  @Get('all')
  @HttpCode(HttpStatus.OK)
  async findAll(
    @Query() query: QueryNotificationDto,
  ): Promise<InfinityPaginationResponseDto<Notification>> {
    const page = query?.page ?? 1;
    let limit = query?.limit ?? 10;
    if (limit > 50) {
      limit = 50;
    }

    return infinityPagination(
      await this.notificationsService.findManyWithPagination({
        filterOptions: query?.filters,
        sortOptions: query?.sort,
        paginationOptions: {
          page,
          limit,
        },
      }),
      { page, limit },
    );
  }

  // Get notifications for the authenticated user
  @ApiOkResponse({
    type: [Notification],
  })
  @Get('')
  @HttpCode(HttpStatus.OK)
  async findMyNotifications(@Request() request): Promise<Notification[]> {
    const userId = this.getAuthenticatedUserId(request);
    const userType = this.getAuthenticatedUserType(request);
    const notifications = await this.notificationsService.findByScope(
      userId,
      userType,
    );
    this.logger.log(
      `[NOTIFICATIONS_GET] userId=${userId} userType=${userType} count=${notifications.length}`,
    );
    return notifications;
  }

  // Get unseen notifications for the authenticated user
  @ApiOkResponse({
    type: [Notification],
  })
  @Get('unseen')
  @HttpCode(HttpStatus.OK)
  findMyUnseenNotifications(@Request() request): Promise<Notification[]> {
    const userId = this.getAuthenticatedUserId(request);
    const userType = this.getAuthenticatedUserType(request);
    return this.notificationsService.findUnseenByScope(
      userId,
      userType,
    );
  }

  // Mark all notifications as seen for the authenticated user
  @ApiOkResponse()
  @Patch('mark-all-seen')
  @HttpCode(HttpStatus.OK)
  markAllMyNotificationsAsSeen(@Request() request): Promise<void> {
    const userId = this.getAuthenticatedUserId(request);
    const userType = this.getAuthenticatedUserType(request);
    return this.notificationsService.markAllAsSeenByScope(
      userId,
      userType,
    );
  }

  // Mark all notifications from a specific conversation as seen for the authenticated user
  @ApiOkResponse()
  @Patch('conversation/:conversationId/mark-seen')
  @HttpCode(HttpStatus.OK)
  @ApiParam({
    name: 'conversationId',
    type: String,
    required: true,
  })
  markAllNotificationsFromConversationAsSeen(
    @Request() request,
    @Param('conversationId') conversationId: string
  ): Promise<void> {
    const userId = this.getAuthenticatedUserId(request);
    const userType = this.getAuthenticatedUserType(request);
    return this.notificationsService.markAllAsSeenByConversationScope(
      Number(conversationId),
      userId,
      userType,
    );
  }

  // Toggle seen/unseen for a single notification
  @ApiOkResponse({
    type: Notification,
  })
  @Patch(':id/toggle-seen')
  @HttpCode(HttpStatus.OK)
  @ApiParam({
    name: 'id',
    type: String,
    required: true,
  })
  toggleNotificationSeen(@Param('id') id: Notification['id']): Promise<Notification | null> {
    return this.notificationsService.toggleSeen(id);
  }

  // Toggle seen/unseen for all notifications from a conversation
  @ApiOkResponse()
  @Patch('conversation/:conversationId/toggle-seen')
  @HttpCode(HttpStatus.OK)
  @ApiParam({
    name: 'conversationId',
    type: String,
    required: true,
  })
  toggleConversationNotificationsSeen(
    @Request() request,
    @Param('conversationId') conversationId: string
  ): Promise<void> {
    const userId = this.getAuthenticatedUserId(request);
    const userType = this.getAuthenticatedUserType(request);
    return this.notificationsService.toggleConversationSeen(
      Number(conversationId),
      userId,
      userType,
    );
  }

  // Admin only - Get notifications for specific user
  @ApiOkResponse({
    type: [Notification],
  })
  @Roles(RoleEnum.admin)
  @UseGuards(RolesGuard)
  @Get('user/:userId')
  @HttpCode(HttpStatus.OK)
  @ApiParam({
    name: 'userId',
    type: String,
    required: true,
  })
  findByUserId(@Param('userId') userId: User['id']): Promise<Notification[]> {
    return this.notificationsService.findByUserId(userId);
  }

  // Admin only - Get unseen notifications for specific user
  @ApiOkResponse({
    type: [Notification],
  })
  @Roles(RoleEnum.admin)
  @UseGuards(RolesGuard)
  @Get('user/:userId/unseen')
  @HttpCode(HttpStatus.OK)
  @ApiParam({
    name: 'userId',
    type: String,
    required: true,
  })
  findUnseenByUserId(@Param('userId') userId: User['id']): Promise<Notification[]> {
    return this.notificationsService.findUnseenByUserId(userId);
  }

  @ApiOkResponse({
    type: Notification,
  })
  @Get(':id')
  @HttpCode(HttpStatus.OK)
  @ApiParam({
    name: 'id',
    type: String,
    required: true,
  })
  findOne(@Param('id') id: Notification['id']): Promise<NullableType<Notification>> {
    return this.notificationsService.findById(id);
  }

  @ApiOkResponse({
    type: Notification,
  })
  @Patch(':id')
  @HttpCode(HttpStatus.OK)
  @ApiParam({
    name: 'id',
    type: String,
    required: true,
  })
  update(
    @Param('id') id: Notification['id'],
    @Body() updateNotificationDto: UpdateNotificationDto,
  ): Promise<Notification | null> {
    return this.notificationsService.update(id, updateNotificationDto);
  }

  @ApiOkResponse({
    type: Notification,
  })
  @Patch(':id/mark-seen')
  @HttpCode(HttpStatus.OK)
  @ApiParam({
    name: 'id',
    type: String,
    required: true,
  })
  markAsSeen(@Param('id') id: Notification['id']): Promise<Notification | null> {
    return this.notificationsService.markAsSeen(id);
  }

  // Admin only - Mark all notifications as seen for specific user
  @ApiOkResponse()
  @Roles(RoleEnum.admin)
  @UseGuards(RolesGuard)
  @Patch('user/:userId/mark-all-seen')
  @HttpCode(HttpStatus.OK)
  @ApiParam({
    name: 'userId',
    type: String,
    required: true,
  })
  markAllAsSeenByUserId(@Param('userId') userId: User['id']): Promise<void> {
    return this.notificationsService.markAllAsSeenByUserId(userId);
  }

  @Delete(':id')
  @ApiParam({
    name: 'id',
    type: String,
    required: true,
  })
  @HttpCode(HttpStatus.NO_CONTENT)
  remove(@Param('id') id: Notification['id']): Promise<void> {
    return this.notificationsService.remove(id);
  }
}