import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  IsNotEmpty,
  ValidateNested,
  IsOptional,
  IsString,
  IsDateString,
  IsArray,
  IsNumber,
} from 'class-validator';
import { UserRefDto } from '../../users/dto/user-ref.dto';
import { CitiesRefDto } from '../../cities/dto/cities-ref.dto';

export class CreateMerchandiserDto {
  @ApiProperty({ type: () => UserRefDto })
  @IsNotEmpty()
  @ValidateNested()
  @Type(() => UserRefDto)
  user: UserRefDto;

  @ApiPropertyOptional({ type: String })
  @IsOptional()
  @IsDateString()
  birthday?: string | null;

  @ApiPropertyOptional({ type: String })
  @IsOptional()
  @IsString()
  website?: string | null;

  @ApiProperty({ type: String })
  @IsNotEmpty()
  @IsString()
  street: string;

  @ApiProperty({ type: String })
  @IsNotEmpty()
  @IsString()
  zipCode: string;

  @ApiPropertyOptional({ type: String })
  @IsOptional()
  @IsString()
  tax_id?: string | null;

  @ApiPropertyOptional({ type: String })
  @IsOptional()
  @IsString()
  tax_no?: string | null;

  @ApiProperty({ type: () => CitiesRefDto })
  @IsNotEmpty()
  @ValidateNested()
  @Type(() => CitiesRefDto)
  city: CitiesRefDto;

  @ApiPropertyOptional({ type: String })
  @IsOptional()
  @IsString()
  nationality?: string | null;

  @ApiPropertyOptional({ type: [Number] })
  @IsOptional()
  @IsArray()
  @IsNumber({}, { each: true })
  @Type(() => Number)
  jobTypeIds?: number[];

  @ApiPropertyOptional({ type: [Number] })
  @IsOptional()
  @IsArray()
  @IsNumber({}, { each: true })
  @Type(() => Number)
  contractualIds?: number[];
}
