import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsString } from 'class-validator';

export class CreateLanguagesDto {
  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  name: string;
}