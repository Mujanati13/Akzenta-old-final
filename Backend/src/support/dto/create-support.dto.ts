import { ApiProperty } from '@nestjs/swagger';
import { IsEmail, IsNotEmpty } from 'class-validator';

export class CreateSupportDto {
  @ApiProperty({ example: 'support@example.com' })
  @IsNotEmpty()
  @IsEmail()
  email: string;
}

