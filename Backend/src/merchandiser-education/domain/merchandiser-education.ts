import { ApiProperty } from '@nestjs/swagger';
import { Merchandiser } from '../../merchandiser/domain/merchandiser';

export class MerchandiserEducation {
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
    type: Date,
    description: 'Date of graduation',
    example: '2023-06-15',
    nullable: true,
  })
  graduationDate: Date | null;

  @ApiProperty({
    type: Date,
  })
  createdAt: Date;

  @ApiProperty({
    type: Date,
  })
  updatedAt: Date;
}