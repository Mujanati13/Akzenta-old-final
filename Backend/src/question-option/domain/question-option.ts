import { ApiProperty } from '@nestjs/swagger';
import { Question } from '../../question/domain/question';

export class QuestionOption {
  @ApiProperty({
    type: Number,
  })
  id: number;

  @ApiProperty({
    type: () => Question,
  })
  question: Question;

  @ApiProperty({
    type: String,
  })
  optionText: string;

  @ApiProperty({
    type: Number,
  })
  order: number;

  @ApiProperty({
    type: Date,
  })
  createdAt: Date;

  @ApiProperty({
    type: Date,
  })
  updatedAt: Date;
}