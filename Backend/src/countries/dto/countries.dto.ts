import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsNumber, IsObject } from 'class-validator';

export class CountriesDto {
  @ApiProperty()
  @IsNumber()
  @IsNotEmpty()
  id: number;

  @ApiProperty({
    required: true,
    type: Object,
    description: 'A JSON object containing translations of the country name',
    example: {
      ar: 'المغرب',
      fr: 'Maroc',
      sp: 'Marruecos',
      en: 'Morocco',
    },
  })
  @IsObject()
  name: Record<string, string>;

  @ApiProperty({
    required: true,
    type: Date,
  })
  createdAt: Date;

  @ApiProperty({
    required: true,
    type: Date,
  })
  updatedAt: Date;
}
