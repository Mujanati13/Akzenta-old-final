import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsNotEmpty, ValidateNested, IsOptional, IsString } from 'class-validator';
import { Type } from 'class-transformer';

class QuestionRelationDto {
  @ApiProperty()
  @IsNotEmpty()
  id: number;
}

class QuestionOptionRelationDto {
  @ApiProperty()
  @IsNotEmpty()
  id: number;
}

class ReportRelationDto {
  @ApiProperty()
  @IsNotEmpty()
  id: number;
}

export class CreateAnswerDto {
  @ApiProperty({
    type: QuestionRelationDto,
  })
  @ValidateNested()
  @Type(() => QuestionRelationDto)
  question: QuestionRelationDto;

  @ApiPropertyOptional({
    type: QuestionOptionRelationDto,
  })
  @ValidateNested()
  @Type(() => QuestionOptionRelationDto)
  selectedOption?: QuestionOptionRelationDto;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  textAnswer?: string;

  @ApiProperty({
    type: ReportRelationDto,
  })
  @ValidateNested()
  @Type(() => ReportRelationDto)
  report: ReportRelationDto;
}