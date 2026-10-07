import { ApiProperty } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsNotEmpty } from 'class-validator';

export class CreateConversationDto {
  @ApiProperty({ type: Number })
  @IsNotEmpty()
  @Type(() => Number)
  reportId: number;
}