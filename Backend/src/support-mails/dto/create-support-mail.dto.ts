import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsNumber, IsString } from 'class-validator';

export class CreateSupportMailDto {
  @ApiProperty({ example: 1 })
  @IsNumber()
  @IsNotEmpty()
  userId: number;

  @ApiProperty({ example: 'Report Issue' })
  @IsString()
  @IsNotEmpty()
  subject: string;

  @ApiProperty({ example: 'Message content...' })
  @IsString()
  @IsNotEmpty()
  content: string;
}

