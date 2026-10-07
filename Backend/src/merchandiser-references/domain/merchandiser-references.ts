import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Merchandiser } from '../../merchandiser/domain/merchandiser';

export class MerchandiserReferences {
  @ApiProperty({
    type: Number,
  })
  id: number;

  @ApiProperty({
    type: () => Merchandiser,
  })
  merchandiser: Merchandiser;

  @ApiProperty({
    type: String,
  })
  company: string;

  @ApiProperty({
    type: String,
  })
  activity: string;

  @ApiProperty({
    type: String,
  })
  branche: string;

  @ApiProperty({
    type: Date,
  })
  startDate: Date | null;

  @ApiPropertyOptional({
    type: Date,
  })
  endDate?: Date | null;

  @ApiProperty({
    type: Date,
  })
  createdAt: Date;

  @ApiProperty({
    type: Date,
  })
  updatedAt: Date;
}