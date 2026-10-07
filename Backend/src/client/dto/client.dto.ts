import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsNumber } from 'class-validator';

export class ClientDto {
  @ApiProperty()
  @IsNumber()
  @IsNotEmpty()
  id: number;
}
