import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsNotEmpty, IsString, ValidateNested, IsOptional, IsDateString } from 'class-validator';
import { Type } from 'class-transformer';

class MerchandiserRelationDto {
  @ApiProperty()
  @IsNotEmpty()
  id: number;
}

export class CreateMerchandiserReferencesDto {
  @ApiProperty({
    type: MerchandiserRelationDto,
  })
  @ValidateNested()
  @Type(() => MerchandiserRelationDto)
  merchandiser: MerchandiserRelationDto;

  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  company: string;

  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  activity: string;

  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  branche: string;

  @ApiProperty()
  @IsDateString()
  @IsNotEmpty()
  startDate: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsDateString()
  endDate?: string;
}