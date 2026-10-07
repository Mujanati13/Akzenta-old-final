import { ApiProperty } from '@nestjs/swagger';
import { Akzente } from '../../akzente/domain/akzente';
import { Report } from '../../report/domain/report';
import { Project } from '../../project/domain/project';

export class AkzenteFavoriteProject {
  @ApiProperty({
    type: Number,
  })
  id: number;

  @ApiProperty({
    type: () => Akzente,
  })
  akzente: Akzente;

  @ApiProperty({
    type: () => Project,
  })
  project: Project;

  @ApiProperty()
  createdAt: Date;

  @ApiProperty()
  updatedAt: Date;
}