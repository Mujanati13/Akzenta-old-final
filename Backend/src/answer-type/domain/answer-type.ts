import { ApiProperty } from '@nestjs/swagger';

export enum AnswerTypeEnum {
  TEXT = 1,
  SELECT = 2,
  MULTISELECT = 3,
  BOOLEAN = 4,
}
export class AnswerType {
  @ApiProperty({
    type: Number,
  })
  id: number;

  @ApiProperty({
    type: String,
  })
  name: string;
}