import { ApiProperty } from '@nestjs/swagger';
import { Message } from '../../message/domain/message';

const idType = Number;

export class Conversation {
  @ApiProperty({
    type: idType,
  })
  id: number;

  @ApiProperty({
    type: idType,
  })
  reportId: number;

  @ApiProperty()
  createdAt: Date;

  @ApiProperty()
  updatedAt: Date;

  @ApiProperty({
    type: () => [Message],
    required: false,
  })
  messages?: Message[];

  constructor(partial: Partial<Conversation>) {
    Object.assign(this, partial);
  }
}