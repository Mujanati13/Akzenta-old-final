import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  IsNotEmpty,
  ValidateNested,
  IsOptional,
  IsString,
  IsDateString,
  IsBoolean,
  IsArray,
  IsNumber,
  ValidateIf,
} from 'class-validator';

export class EditAnswerDto {
  @ApiProperty({ type: Number })
  @IsNumber()
  questionId: number;

  @ApiPropertyOptional({ type: String })
  @IsOptional()
  @IsString()
  textAnswer?: string;

  @ApiPropertyOptional({ type: Number })
  @IsOptional()
  @IsNumber()
  selectedOptionId?: number;
}

export class EditStatusDto {
  @ApiProperty({ type: Number })
  @IsNumber()
  id: number;

  @ApiProperty({ type: String })
  @IsString()
  name: string;
}

export class PhotoOrderUpdateDto {
  @ApiProperty({ type: Number })
  @IsNumber()
  uploadedPhotoId: number;

  @ApiProperty({ type: Number })
  @IsNumber()
  advancedPhotoId: number;

  @ApiPropertyOptional({ enum: ['before', 'after'] })
  @IsOptional()
  @IsString()
  beforeAfterType?: 'before' | 'after';

  @ApiPropertyOptional({ type: String })
  @IsOptional()
  @IsString()
  label?: string;

  @ApiProperty({ type: Number })
  @IsNumber()
  order: number;
}

export class EditReportDto {
  @ApiPropertyOptional({ type: String })
  @IsOptional()
  @IsDateString()
  appointmentDate?: string;

  @ApiPropertyOptional({ type: String })
  @IsOptional()
  @IsDateString()
  visitDate?: string;

  @ApiPropertyOptional({ type: String })
  @IsOptional()
  @IsDateString()
  reportTo?: string;

  @ApiPropertyOptional({ type: String })
  @IsOptional()
  @IsDateString()
  nextVisitDate?: string;

  @ApiPropertyOptional({ type: [EditAnswerDto] })
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => EditAnswerDto)
  answers?: EditAnswerDto[];

  @ApiPropertyOptional({ type: () => EditStatusDto })
  @IsOptional()
  @ValidateNested()
  @Type(() => EditStatusDto)
  status?: EditStatusDto;

  @ApiPropertyOptional({ type: Number, nullable: true })
  @IsOptional()
  @ValidateIf((_, value) => value !== null)
  @IsNumber()
  merchandiserId?: number | null;

  @ApiPropertyOptional({ type: [Number] })
  @IsOptional()
  @IsArray()
  @IsNumber({}, { each: true })
  filesToDelete?: number[];

  @ApiPropertyOptional({ type: [PhotoOrderUpdateDto] })
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => PhotoOrderUpdateDto)
  photoOrderUpdates?: PhotoOrderUpdateDto[];
} 