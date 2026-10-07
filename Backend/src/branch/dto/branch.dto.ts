import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsNumber } from 'class-validator';

export class BranchDto {
  @ApiProperty()
  @IsNumber()
  @IsNotEmpty()
  id: number;
}
