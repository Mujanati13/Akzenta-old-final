import { ApiProperty } from '@nestjs/swagger';
import { Project } from '../../project/domain/project';
import { Client } from '../../client/domain/client';

export class ClientFavoriteProject {
  @ApiProperty({
    type: Number,
  })
  id: number;

  @ApiProperty({
    type: () => Client,
  })
  client: Client;

  @ApiProperty({
    type: () => Project,
  })
  project: Project;

  @ApiProperty()
  createdAt: Date;

  @ApiProperty()
  updatedAt: Date;
}