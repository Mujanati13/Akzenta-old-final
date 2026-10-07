import {
  // decorators here
  Type,
} from 'class-transformer';

import {
  // decorators here

  IsArray,
  ValidateNested,
  IsOptional,
  IsString,
  IsObject,
} from 'class-validator';

import {
  // decorators here
  ApiProperty,
} from '@nestjs/swagger';
import { CitiesDto } from '../../cities/dto/cities.dto';

export class CreateCountriesDto {
  @ApiProperty({
    required: false,
    type: () => String,
  })
  @IsOptional()
  @IsString()
  flag?: string | null;

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
    required: false,
    type: () => [CitiesDto],
  })
  @IsOptional()
  @ValidateNested()
  @Type(() => CitiesDto)
  @IsArray()
  cities?: CitiesDto[] | null;

  // Don't forget to use the class-validator decorators in the DTO properties.
}
