import { CountriesRefDto } from '../../countries/dto/countries-ref.dto';
import { Type } from 'class-transformer';
import {
  ValidateNested,
  IsNotEmptyObject,
  IsString,
  IsArray,
  IsNumber,
} from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class CreateCitiesDto {
  @ApiProperty({
    required: true,
    type: () => String,
  })
  @IsString()
  name: string;

  @ApiProperty({
    required: true,
    type: [Number],
    description: 'Coordinates as [latitude, longitude]',
    example: [34.020882, -6.84165],
  })
  @IsArray()
  @IsNumber({}, { each: true })
  coordinates: [number, number];

  @ApiProperty({
    required: true,
    type: () => CountriesRefDto,
  })
  @ValidateNested()
  @Type(() => CountriesRefDto)
  @IsNotEmptyObject()
  country: CountriesRefDto;
}