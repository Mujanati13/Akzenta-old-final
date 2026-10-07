import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsNotEmpty, ValidateNested, IsOptional, IsString, IsNumber } from 'class-validator';
import { AdvancedPhotoDto } from '../../advanced-photo/dto/advanced-photo.dto';
import { FileDto } from '../../files/dto/file.dto';
import { ReportDto } from '../../report/dto/report.dto';

export class CreateUploadedAdvancedPhotoDto {
  @ApiProperty({ type: () => AdvancedPhotoDto })
  @IsNotEmpty()
  @ValidateNested()
  @Type(() => AdvancedPhotoDto)
  advancedPhoto: AdvancedPhotoDto;

  @ApiProperty({ type: () => FileDto })
  @IsNotEmpty()
  @ValidateNested()
  @Type(() => FileDto)
  file: FileDto;
  
  @ApiProperty({ type: () => ReportDto })
  @IsNotEmpty()
  @ValidateNested()
  @Type(() => ReportDto)
  report: ReportDto;

  @ApiPropertyOptional({ type: String })
  @IsOptional()
  @IsString()
  label?: string | null;

  @ApiPropertyOptional({ enum: ['before', 'after'] })
  @IsOptional()
  @IsString()
  beforeAfterType?: 'before' | 'after' | null;

  @ApiPropertyOptional({ type: Number })
  @IsOptional()
  @IsNumber()
  order?: number;
}
