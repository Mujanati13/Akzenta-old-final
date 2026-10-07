import { ApiProperty } from '@nestjs/swagger';
import { Client } from '../../client/domain/client';
import { Project } from '../../project/domain/project';

export class ProjectAssignedClient {
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
