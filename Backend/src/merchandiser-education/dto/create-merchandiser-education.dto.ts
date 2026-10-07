import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsString, ValidateNested, IsOptional, IsDateString } from 'class-validator';
import { Type } from 'class-transformer';

class MerchandiserRelationDto {
  @ApiProperty()
  @IsNotEmpty()
  id: number;
}

export class CreateMerchandiserEducationDto {
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

  @ApiProperty({
    description: 'Date of graduation',
    example: '2023-06-15',
    type: 'string',
    format: 'date',
  })
  @IsDateString()
  @IsOptional()
  graduationDate: string | null;
}