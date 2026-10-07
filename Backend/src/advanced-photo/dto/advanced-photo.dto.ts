import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsNumber } from 'class-validator';

export class AdvancedPhotoDto {
  @ApiProperty()
  @IsNumber()
  @IsNotEmpty()
  id: number;
}
