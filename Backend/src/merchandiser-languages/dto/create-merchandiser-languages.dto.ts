import { ApiProperty } from '@nestjs/swagger';
import { IsEnum, IsNotEmpty, ValidateNested } from 'class-validator';
import { Type } from 'class-transformer';
import { LanguageLevel } from '../domain/merchandiser-languages';

class MerchandiserRelationDto {
  @ApiProperty()
  @IsNotEmpty()
  id: number;
}

class LanguageRelationDto {
  @ApiProperty()
  @IsNotEmpty()
  id: number;
}

export class CreateMerchandiserLanguagesDto {
  @ApiProperty({
    type: MerchandiserRelationDto,
  })
  @ValidateNested()
  @Type(() => MerchandiserRelationDto)
  merchandiser: MerchandiserRelationDto;

  @ApiProperty({
    type: LanguageRelationDto,
  })
  @ValidateNested()
  @Type(() => LanguageRelationDto)
  language: LanguageRelationDto;

  @ApiProperty({
    enum: LanguageLevel,
  })
  @IsEnum(LanguageLevel)
  level: LanguageLevel;
}