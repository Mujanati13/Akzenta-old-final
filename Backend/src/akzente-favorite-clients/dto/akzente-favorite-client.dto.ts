import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsString } from 'class-validator';

export class AkzenteFavoriteClientDto {
  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  id: string;
}
