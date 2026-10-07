import { ApiProperty } from '@nestjs/swagger';
import { IsArray, IsNotEmpty, IsNumber, IsOptional } from 'class-validator';

export class MerchandiserDto {
  @ApiProperty()
  @IsNumber()
  @IsNotEmpty()
  id: number;
}
