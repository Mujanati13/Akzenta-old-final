import { ApiProperty } from '@nestjs/swagger';
import { IsNumber } from 'class-validator';

export class MerchandiserStatusDto {
  @ApiProperty()
  @IsNumber()
  id: number;
}
