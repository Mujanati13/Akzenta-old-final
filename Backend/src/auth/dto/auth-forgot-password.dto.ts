import { ApiProperty } from '@nestjs/swagger';
import { IsEmail, IsOptional, IsNumber } from 'class-validator';
import { Transform } from 'class-transformer';
import { lowerCaseTransformer } from '../../utils/transformers/lower-case.transformer';

export class AuthForgotPasswordDto {
  @ApiProperty({ example: 'test1@example.com', type: String })
  @Transform(lowerCaseTransformer)
  @IsEmail()
  email: string;

  @ApiProperty({ example: 3, type: Number, required: false, description: 'User type ID (1=akzente, 2=client, 3=merchandiser)' })
  @IsOptional()
  @IsNumber()
  userType?: number;
}
