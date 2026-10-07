import { ApiProperty } from '@nestjs/swagger';
import { Akzente } from '../../akzente/domain/akzente';
import { Merchandiser } from '../../merchandiser/domain/merchandiser';

export class Review {
  @ApiProperty({
    type: Number,
  })
  id: number;

  @ApiProperty({
    type: () => Akzente,
  })
  akzente: Akzente;

  @ApiProperty({
    type: () => Merchandiser,
  })
  merchandiser: Merchandiser;

  @ApiProperty({
    type: Number,
    minimum: 1,
    maximum: 5,
    description: 'Rating from 1 to 5 stars',
  })
  rating: number;

  @ApiProperty({
    type: String,
    description: 'Review text',
  })
  review: string;

  @ApiProperty({
    type: Date,
  })
  createdAt: Date;

  @ApiProperty({
    type: Date,
  })
  updatedAt: Date;
}