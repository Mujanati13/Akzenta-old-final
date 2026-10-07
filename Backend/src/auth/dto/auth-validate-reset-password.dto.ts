import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsNumber, IsOptional } from 'class-validator';

export class AuthValidateResetPasswordDto {
  @ApiProperty()
  @IsNotEmpty()
  hash: string;

  @ApiProperty({
    example: 1,
    type: Number,
    required: false,
    description: 'User type ID (1=akzente, 2=client, 3=merchandiser)',
  })
  @IsOptional()
  @IsNumber()
  userType?: number;
}
