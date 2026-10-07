import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsNumber } from 'class-validator';

export class ProjectAssignedClientDto {
  @ApiProperty()
  @IsNumber()
  @IsNotEmpty()
  id: number;
}
