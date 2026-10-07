import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsNotEmpty, IsString, IsBoolean, IsOptional, IsEnum, IsNumber } from 'class-validator';

export class CreateMessageDto {
  @ApiProperty({ type: Number })
  @IsNotEmpty()
  @IsNumber()
  @Type(() => Number)
  conversationId: number;

  @ApiProperty({ type: Number })
  @IsNotEmpty()
  @IsNumber()
  @Type(() => Number)
  senderId: number;

  @ApiProperty({ type: Number })
  @IsNotEmpty()
  @IsNumber()
  @Type(() => Number)
  receiverId: number;

  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  content: string;

  @ApiPropertyOptional({ default: false })
  @IsBoolean()
  @IsOptional()
  seen?: boolean;

  @ApiPropertyOptional({ enum: ['akzente', 'client', 'merchandiser'] })
  @IsEnum(['akzente', 'client', 'merchandiser'])
  @IsOptional()
  receiverType?: string;
}