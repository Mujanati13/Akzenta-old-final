import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsNumber } from 'class-validator';

export class ReportDto {
  @ApiProperty()
  @IsNumber()
  @IsNotEmpty()
  id: number;
}
