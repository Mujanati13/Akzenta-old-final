import { ApiProperty } from '@nestjs/swagger';
import { User } from '../../users/domain/user';
import { Conversation } from '../../conversation/domain/conversation';

const idType = Number;

export class Notification {
  @ApiProperty({
    type: idType,
  })
  id: number | string;

  @ApiProperty({
    type: String,
    example: 'Your report has been approved',
  })
  message: string;

  @ApiProperty({
    type: Boolean,
    example: false,
  })
  seen: boolean;

  @ApiProperty({
    type: String,
    example: '/reports/123',
    nullable: true,
  })
  link?: string | null;

  @ApiProperty({
    type: () => User,
  })
  user: User;

  @ApiProperty({
    type: () => Conversation,
    nullable: true,
  })
  conversation?: Conversation | null;

  @ApiProperty()
  createdAt: Date;

  @ApiProperty()
  updatedAt: Date;

  @ApiProperty()
  deletedAt: Date;

  constructor(partial: Partial<Notification> = {}) {
    Object.assign(this, partial);
  }
}