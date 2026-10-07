import { ApiProperty } from '@nestjs/swagger';
import { Client } from '../../client/domain/client';

export class SupportMail {
  @ApiProperty({
    type: Number,
  })
  id: number;

  @ApiProperty({
    type: () => Client,
  })
  client: Client;

  @ApiProperty({
    type: String,
  })
  subject: string;

  @ApiProperty({
    type: String,
  })
  content: string;

  @ApiProperty()
  createdAt: Date;

  @ApiProperty()
  updatedAt: Date;
}

