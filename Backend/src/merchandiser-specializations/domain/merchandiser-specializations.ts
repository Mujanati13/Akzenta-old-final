import { ApiProperty } from '@nestjs/swagger';
import { Merchandiser } from '../../merchandiser/domain/merchandiser';
import { Specializations } from '../../specializations/domain/specializations';

export class MerchandiserSpecializations {
  @ApiProperty({
    type: Number,
  })
  id: number;

  @ApiProperty({
    type: () => Merchandiser,
  })
  merchandiser: Merchandiser;

  @ApiProperty({
    type: () => Specializations,
  })
  specialization: Specializations;

  @ApiProperty({
    type: Date,
  })
  createdAt: Date;

  @ApiProperty({
    type: Date,
  })
  updatedAt: Date;
}