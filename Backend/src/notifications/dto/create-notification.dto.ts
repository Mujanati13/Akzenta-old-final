import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsNotEmpty, IsString, IsOptional, IsBoolean } from 'class-validator';
import { Type } from 'class-transformer';
import { UserRefDto } from '../../users/dto/user-ref.dto';

export class CreateNotificationDto {
  @ApiProperty({ example: 'Your report has been approved' })
  @IsNotEmpty()
  @IsString()
  message: string;

  @ApiPropertyOptional({ example: false, default: false })
  @IsOptional()
  @IsBoolean()
  seen?: boolean;

  @ApiPropertyOptional({ example: '/reports/123' })
  @IsOptional()
  @IsString()
  link?: string | null;

  @ApiProperty({ type: () => UserRefDto })
  @Type(() => UserRefDto)
  user: UserRefDto;
}