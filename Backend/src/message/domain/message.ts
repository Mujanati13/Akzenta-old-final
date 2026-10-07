import { ApiProperty } from '@nestjs/swagger';
import { UserType } from '../../user-type/domain/user-type';
import { FileType } from '../../files/domain/file';

const idType = Number;

export class Message {
  @ApiProperty({
    type: idType,
  })
  id: number;

  @ApiProperty({
    type: idType,
  })
  conversationId: number;

  @ApiProperty({
    type: idType,
  })
  senderId: number;

  @ApiProperty({
    type: String,
    required: false,
  })
  senderFirstName?: string | null;

  @ApiProperty({
    type: String,
    required: false,
  })
  senderLastName?: string | null;

  @ApiProperty({
    type: () => UserType,
    required: false,
  })
  senderType?: UserType;

  @ApiProperty({
    type: () => FileType,
    required: false,
  })
  senderPhoto?: FileType | null;

  @ApiProperty({
    type: idType,
  })
  receiverId: number;

  @ApiProperty({
    type: String,
    required: false,
  })
  receiverFirstName?: string | null;

  @ApiProperty({
    type: String,
    required: false,
  })
  receiverLastName?: string | null;

  @ApiProperty({
    type: () => UserType,
    required: false,
  })
  receiverType?: UserType;

  @ApiProperty({
    type: () => FileType,
    required: false,
  })
  receiverPhoto?: FileType | null;

  @ApiProperty({
    type: String,
  })
  content: string;

  @ApiProperty({
    type: Boolean,
  })
  seen: boolean;

  @ApiProperty({
    type: String,
    nullable: true,
  })
  receiverTypeString: string | null;

  @ApiProperty()
  createdAt: Date;

  @ApiProperty()
  updatedAt: Date;

  constructor(partial: Partial<Message>) {
    Object.assign(this, partial);
  }
}