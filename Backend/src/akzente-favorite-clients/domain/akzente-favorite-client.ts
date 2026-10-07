import { ApiProperty } from '@nestjs/swagger';
import { Akzente } from '../../akzente/domain/akzente';
import { Client } from '../../client/domain/client';

export class AkzenteFavoriteClient {
  @ApiProperty({
    type: Number,
  })
  id: number;

  @ApiProperty({
    type: () => Akzente,
  })
  akzente: Akzente;

  @ApiProperty({
    type: () => Client,
  })
  client: Client;

  @ApiProperty()
  createdAt: Date;

  @ApiProperty()
  updatedAt: Date;
}