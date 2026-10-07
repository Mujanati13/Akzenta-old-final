import { ApiProperty } from '@nestjs/swagger';
import { Merchandiser } from '../../merchandiser/domain/merchandiser';
import { Languages } from '../../languages/domain/languages';

export enum LanguageLevel {
  BASIC = 'basic',
  INTERMEDIATE = 'intermediate',
  ADVANCED = 'advanced',
  FLUENT = 'fluent',
  NATIVE = 'native',
}

export class MerchandiserLanguages {
  @ApiProperty({
    type: Number,
  })
  id: number;

  @ApiProperty({
    type: () => Merchandiser,
  })
  merchandiser: Merchandiser;

  @ApiProperty({
    type: () => Languages,
  })
  language: Languages;

  @ApiProperty({
    enum: LanguageLevel,
  })
  level: LanguageLevel;

  @ApiProperty({
    type: Date,
  })
  createdAt: Date;

  @ApiProperty({
    type: Date,
  })
  updatedAt: Date;
}