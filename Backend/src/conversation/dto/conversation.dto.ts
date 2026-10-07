import { ApiProperty } from '@nestjs/swagger';
import { IsNumber } from 'class-validator';

export class ConversationDto {
  @ApiProperty()
  @IsNumber()
  id: number;
}