import { ApiProperty } from '@nestjs/swagger';
import {
  IsArray,
  IsNotEmpty,
  IsNotEmptyObject,
  IsNumber,
  IsOptional,
  IsString,
  ValidateNested,
} from 'class-validator';
import { CountriesDto } from '../../countries/dto/countries.dto';
import { Transform, Type } from 'class-transformer';

export class CitiesDto {
  @ApiProperty()
  @IsNumber()
  @IsNotEmpty()
  @Transform(({ value }) => parseInt(value, 10))
  id: number;

  @ApiProperty({
    required: true,
    type: () => String,
  })
  @IsString()
  @IsOptional()
  name: string;

  @ApiProperty({
    required: true,
    type: [Number],
    description: 'Coordinates as [latitude, longitude]',
    example: [34.020882, -6.84165],
  })
  @IsArray()
  @IsNumber({}, { each: true })
  @IsOptional()
  coordinates: [number, number];

  @ApiProperty({
    required: true,
    type: () => CountriesDto,
  })
  @ValidateNested()
  @Type(() => CountriesDto)
  @IsNotEmptyObject()
  @IsOptional()
  country: CountriesDto;

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