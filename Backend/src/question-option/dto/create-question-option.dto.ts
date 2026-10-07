import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, ValidateNested, IsString, IsNumber } from 'class-validator';
import { Type } from 'class-transformer';

class QuestionRelationDto {
  @ApiProperty()
  @IsNotEmpty()
  id: number;
}

export class CreateQuestionOptionDto {
  @ApiProperty({
    type: QuestionRelationDto,
  })
  @ValidateNested()
  @Type(() => QuestionRelationDto)
  question: QuestionRelationDto;

  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  optionText: string;

  @ApiProperty()
  @IsNumber()
  order: number;
}