import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsOptional, IsNumber } from 'class-validator';

export class AuthResetPasswordDto {
  @ApiProperty()
  @IsNotEmpty()
  password: string;

  @ApiProperty()
  @IsNotEmpty()
  hash: string;

  @ApiProperty({ example: 3, type: Number, required: false, description: 'User type ID (1=akzente, 2=client, 3=merchandiser)' })
  @IsOptional()
  @IsNumber()
  userType?: number;
}
