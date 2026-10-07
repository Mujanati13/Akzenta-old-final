import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsNumber, IsString } from 'class-validator';

export class CountriesPaginatedDto {
  @ApiProperty()
  @IsNumber()
  @IsNotEmpty()
  id: number;

  @ApiProperty({
    type: String,
    description: 'Country name in the requested language',
  })
  @IsString()
  name: string;

  @ApiProperty({
    required: false,
    type: String,
  })
  flag?: string | null;

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