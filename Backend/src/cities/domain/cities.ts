import { Countries } from '../../countries/domain/countries';
import { ApiProperty } from '@nestjs/swagger';

export class Cities {
  @ApiProperty({
    type: Number,
  })
  id: number;

  @ApiProperty({
    type: () => String,
    nullable: false,
  })
  name: string;

  @ApiProperty({
    type: [Number],
    description: 'Coordinates as [latitude, longitude]',
    example: [34.020882, -6.84165],
  })
  coordinates: [number, number];

  @ApiProperty({
    type: () => Countries,
    nullable: false,
  })
  country: Countries;

  @ApiProperty()
  createdAt: Date;

  @ApiProperty()
  updatedAt: Date;
}