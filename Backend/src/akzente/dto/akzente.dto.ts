import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsNumber } from 'class-validator';

export class AkzenteDto {
  @ApiProperty()
  @IsNumber()
  @IsNotEmpty()
  id: number;
}
