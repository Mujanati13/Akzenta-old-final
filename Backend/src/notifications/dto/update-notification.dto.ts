import { PartialType, ApiPropertyOptional } from '@nestjs/swagger';
import { CreateNotificationDto } from './create-notification.dto';
import { IsOptional, IsBoolean, IsString } from 'class-validator';

export class UpdateNotificationDto extends PartialType(CreateNotificationDto) {
  @ApiPropertyOptional({ example: 'Updated notification message' })
  @IsOptional()
  @IsString()
  message?: string;

  @ApiPropertyOptional({ example: true })
  @IsOptional()
  @IsBoolean()
  seen?: boolean;

  @ApiPropertyOptional({ example: '/reports/456' })
  @IsOptional()
  @IsString()
  link?: string | null;
}