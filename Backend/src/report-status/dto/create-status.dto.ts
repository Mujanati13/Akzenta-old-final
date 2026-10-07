import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsString, IsOptional } from 'class-validator';

export class CreateReportStatusDto {
  @ApiProperty({ type: String })
  @IsNotEmpty()
  @IsString()
  name: string;

  @ApiProperty({ type: String })
  @IsOptional()
  @IsString()
  akzenteName?: string | null;

  @ApiProperty({ type: String })
  @IsOptional()
  @IsString()
  clientName?: string | null;

  @ApiProperty({ type: String })
  @IsOptional()
  @IsString()
  merchandiserName?: string | null;

  @ApiProperty({ type: String })
  @IsOptional()
  @IsString()
  akzenteColor?: string | null;

  @ApiProperty({ type: String })
  @IsOptional()
  @IsString()
  clientColor?: string | null;

  @ApiProperty({ type: String })
  @IsOptional()
  @IsString()
  merchandiserColor?: string | null;
}
