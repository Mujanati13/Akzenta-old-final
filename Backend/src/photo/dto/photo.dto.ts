import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsNumber } from 'class-validator';

export class PhotoDto {
  @ApiProperty()
  @IsNumber()
  @IsNotEmpty()
  id: number;
}
