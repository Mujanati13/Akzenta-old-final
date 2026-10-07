import { ApiProperty } from '@nestjs/swagger';
import { IsNumber } from 'class-validator';

export class MessageDto {
  @ApiProperty()
  @IsNumber()
  id: number;
}