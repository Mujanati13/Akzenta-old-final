import { ApiProperty } from '@nestjs/swagger';
import { Akzente } from '../../akzente/domain/akzente';
import { Report } from '../../report/domain/report';

export class AkzenteFavoriteReport {
  @ApiProperty({
    type: Number,
  })
  id: number;

  @ApiProperty({
    type: () => Akzente,
  })
  akzente: Akzente;

  @ApiProperty({
    type: () => Report,
  })
  report: Report;

  @ApiProperty()
  createdAt: Date;

  @ApiProperty()
  updatedAt: Date;
}