import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  IsNotEmpty,
  ValidateNested,
  IsOptional,
  IsString,
  IsDateString,
  IsArray,
} from 'class-validator';
import { ClientCompanyDto } from '../../client-company/dto/client-company.dto';
import { CreatePhotoDto } from '../../photo/dto/create-photo.dto';
import { CreateAdvancedPhotoDto } from '../../advanced-photo/dto/create-advanced-photo.dto';
import { CreateQuestionDto } from '../../question/dto/create-question.dto';
import { CreateQuestionOptionDto } from '../../question-option/dto/create-question-option.dto';

export class CreateProjectDto {
  @ApiProperty({ type: String })
  @IsNotEmpty()
  @IsString()
  name: string;

  @ApiPropertyOptional({ type: String })
  @IsOptional()
  @IsDateString()
  startDate?: string | null;

  @ApiPropertyOptional({ type: String })
  @IsOptional()
  @IsDateString()
  endDate?: string | null;

  @ApiPropertyOptional({ type: Boolean })
  @IsOptional()
  isSpecCompliantEnabled?: boolean;

  @ApiPropertyOptional({ type: String })
  @IsOptional()
  @IsString()
  feedback?: string | null;

  @ApiProperty({ type: () => ClientCompanyDto })
  @IsNotEmpty()
  @ValidateNested()
  @Type(() => ClientCompanyDto)
  clientCompany: ClientCompanyDto;

  @ApiPropertyOptional({ type: [CreatePhotoDto] })
  @IsOptional()
  @IsArray()
  photos?: CreatePhotoDto[];

  @ApiPropertyOptional({ type: [CreateAdvancedPhotoDto] })
  @IsOptional()
  @IsArray()
  advancedPhotos?: CreateAdvancedPhotoDto[];

  @ApiPropertyOptional({ type: [CreateQuestionDto] })
  @IsOptional()
  @IsArray()
  questions?: (CreateQuestionDto & { options?: CreateQuestionOptionDto[] })[];

  @ApiPropertyOptional({ type: [Number] })
  @IsOptional()
  @IsArray()
  clientContactIds?: number[];

  @ApiPropertyOptional({ type: [Number] })
  @IsOptional()
  @IsArray()
  salesContactIds?: number[];

  @ApiPropertyOptional({ type: String, nullable: true })
  @IsOptional()
  @IsString()
  photoImageNamePattern?: string | null;
}
