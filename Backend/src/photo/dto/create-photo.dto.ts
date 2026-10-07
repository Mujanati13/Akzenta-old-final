import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  IsNotEmpty,
  ValidateNested,
  IsOptional,
  IsBoolean,
  IsNumber,
} from 'class-validator';
import { ProjectDto } from '../../project/dto/project.dto';

export class CreatePhotoDto {
  @ApiProperty({ type: () => ProjectDto })
  @IsNotEmpty()
  @ValidateNested()
  @Type(() => ProjectDto)
  project: ProjectDto;

  @ApiProperty({ type: Number })
  @IsNotEmpty()
  @IsNumber()
  order: number;

  @ApiPropertyOptional({ type: Boolean })
  @IsOptional()
  @IsBoolean()
  isBeforeAfter?: boolean | null;

  @ApiProperty()
  @IsBoolean()
  isVisibleInReport: boolean;
}
