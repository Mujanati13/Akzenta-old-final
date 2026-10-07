import { ApiProperty } from '@nestjs/swagger';
import { Transform, Type } from 'class-transformer';
import {
  IsEmail,
  IsNotEmpty,
  MinLength,
  IsString,
  IsOptional,
  IsNumber,
  IsArray,
} from 'class-validator';
import { lowerCaseTransformer } from '../../utils/transformers/lower-case.transformer';

export class AuthRegisterLoginDto {
  @ApiProperty({ example: 'test1@example.com' })
  @Transform(lowerCaseTransformer)
  @IsEmail()
  @IsNotEmpty()
  email: string;

  @ApiProperty()
  @MinLength(6)
  password: string;

  @ApiProperty({ example: 'John' })
  @IsNotEmpty()
  @IsString()
  firstName: string;

  @ApiProperty({ example: 'Doe' })
  @IsNotEmpty()
  @IsString()
  lastName: string;

  @ApiProperty({ example: '+1234567890', required: false })
  @IsOptional()
  @IsString()
  phone?: string;

  @ApiProperty({ example: '12345', required: false })
  @IsOptional()
  @IsString()
  zipCode?: string;

  @ApiProperty({ example: 2 })
  @IsOptional()
  @IsNumber()
  @Type(() => Number)
  cityId?: number;

  @ApiProperty({ example: 'Berlin', required: false })
  @IsOptional()
  @IsString()
  cityName?: string;

  @ApiProperty({ example: 2 })
  @IsOptional()
  @IsNumber()
  @Type(() => Number)
  countryId?: number;

  @ApiProperty({ example: 'Deutschland', required: false })
  @IsOptional()
  @IsString()
  countryName?: string;

  @ApiProperty({ example: [1, 4] })
  @IsArray()
  @IsNumber({}, { each: true })
  @Type(() => Number)
  jobTypeIds: number[];
}
