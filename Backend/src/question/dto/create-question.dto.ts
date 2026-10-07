import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, ValidateNested, IsBoolean, IsString } from 'class-validator';
import { Type } from 'class-transformer';

class ProjectRelationDto {
  @ApiProperty()
  @IsNotEmpty()
  id: number;
}

class AnswerTypeRelationDto {
  @ApiProperty()
  @IsNotEmpty()
  id: number;
}

export class CreateQuestionDto {
  @ApiProperty({
    type: ProjectRelationDto,
  })
  @ValidateNested()
  @Type(() => ProjectRelationDto)
  project: ProjectRelationDto;

  @ApiProperty({
    type: AnswerTypeRelationDto,
  })
  @ValidateNested()
  @Type(() => AnswerTypeRelationDto)
  answerType: AnswerTypeRelationDto;

  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  questionText: string;

  @ApiProperty()
  @IsBoolean()
  isRequired: boolean;

  @ApiProperty()
  @IsBoolean()
  isVisibleToClient: boolean;

  @ApiProperty()
  @IsBoolean()
  showInOverview: boolean;
}