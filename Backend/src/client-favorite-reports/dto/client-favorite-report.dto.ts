import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsString } from 'class-validator';

export class ClientFavoriteReportDto {
  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  id: string;
}
