import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { AnswerType } from '../../answer-type/domain/answer-type';
import { Project } from '../../project/domain/project';
import { QuestionOption } from '../../question-option/domain/question-option';

export class Question {
  @ApiProperty({
    type: Number,
  })
  id: number;

  @ApiProperty({
    type: () => Project,
  })
  project: Project;

  @ApiProperty({
    type: () => AnswerType,
  })
  answerType: AnswerType;

  @ApiProperty({
    type: String,
  })
  questionText: string;

  @ApiProperty({
    type: Boolean,
  })
  isRequired: boolean;

  @ApiProperty({
    type: Boolean,
  })
  isVisibleToClient: boolean;

  @ApiProperty({
    type: Boolean,
  })
  showInOverview: boolean;

  @ApiPropertyOptional({
    type: () => [QuestionOption],
  })
  options?: QuestionOption[];

  @ApiProperty({
    type: Date,
  })
  createdAt: Date;

  @ApiProperty({
    type: Date,
  })
  updatedAt: Date;
}