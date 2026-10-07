import { ApiProperty } from '@nestjs/swagger';
import { Report } from '../../report/domain/report';
import { Merchandiser } from '../../merchandiser/domain/merchandiser';

export class MerchandiserFavoriteReports {
  @ApiProperty({
    type: Number,
  })
  id: number;

  @ApiProperty({
    type: () => Report,
  })
  report: Report;

  @ApiProperty({
    type: () => Merchandiser,
  })
  merchandiser: Merchandiser;

  @ApiProperty({
    type: Date,
  })
  createdAt: Date;

  @ApiProperty({
    type: Date,
  })
  updatedAt: Date;
}