import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsNumber } from 'class-validator';

export class StatusDto {
  @ApiProperty()
  @IsNumber()
  @IsNotEmpty()
  id: number;
}
