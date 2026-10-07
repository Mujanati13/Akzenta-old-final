import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Question } from '../../question/domain/question';
import { QuestionOption } from '../../question-option/domain/question-option';
import { Report } from '../../report/domain/report';

export class Answer {
  @ApiProperty({
    type: Number,
  })
  id: number;

  @ApiProperty({
    type: () => Question,
  })
  question: Question;

  @ApiProperty({
    type: () => QuestionOption,
  })
  selectedOption: QuestionOption | null;

  @ApiPropertyOptional({
    type: String,
  })
  textAnswer?: string | null;

  @ApiProperty({
    type: () => Report,
  })
  report: Report;

  @ApiProperty({
    type: Date,
  })
  createdAt: Date;

  @ApiProperty({
    type: Date,
  })
  updatedAt: Date;
}