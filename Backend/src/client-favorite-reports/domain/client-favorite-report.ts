import { ApiProperty } from '@nestjs/swagger';
import { Report } from '../../report/domain/report';
import { Client } from '../../client/domain/client';

export class ClientFavoriteReport {
  @ApiProperty({
    type: Number,
  })
  id: number;

  @ApiProperty({
    type: () => Client,
  })
  client: Client;

  @ApiProperty({
    type: () => Report,
  })
  report: Report;

  @ApiProperty()
  createdAt: Date;

  @ApiProperty()
  updatedAt: Date;
}