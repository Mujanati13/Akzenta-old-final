import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  IsNotEmpty,
  ValidateNested,
  IsOptional,
  IsString,
  IsDateString,
  IsBoolean,
} from 'class-validator';
import { ProjectDto } from '../../project/dto/project.dto';
import { ClientCompanyDto } from '../../client-company/dto/client-company.dto';
import { MerchandiserDto } from '../../merchandiser/dto/merchandiser.dto';
import { BranchDto } from '../../branch/dto/branch.dto';
import { StatusDto } from '../../report-status/dto/status.dto';

export class CreateReportDto {
  @ApiProperty({ type: () => ProjectDto })
  @IsNotEmpty()
  @ValidateNested()
  @Type(() => ProjectDto)
  project: ProjectDto;

  @ApiProperty({ type: () => StatusDto })
  @IsNotEmpty()
  @ValidateNested()
  @Type(() => StatusDto)
  status: StatusDto;

  @ApiProperty({ type: () => ClientCompanyDto })
  @IsNotEmpty()
  @ValidateNested()
  @Type(() => ClientCompanyDto)
  clientCompany: ClientCompanyDto;

  @ApiPropertyOptional({ type: () => MerchandiserDto })
  @IsOptional()
  @ValidateNested()
  @Type(() => MerchandiserDto)
  merchandiser?: MerchandiserDto | null;

  @ApiProperty({ type: () => BranchDto })
  @IsNotEmpty()
  @ValidateNested()
  @Type(() => BranchDto)
  branch: BranchDto;

  @ApiPropertyOptional({ type: String })
  @IsOptional()
  @IsString()
  street?: string | null;

  @ApiPropertyOptional({ type: String })
  @IsOptional()
  @IsString()
  zipCode?: string | null;

  @ApiPropertyOptional({ type: String })
  @IsOptional()
  @IsDateString()
  plannedOn?: string | null;

  @ApiPropertyOptional({ type: String })
  @IsOptional()
  @IsString()
  note?: string | null;

  @ApiPropertyOptional({ type: String })
  @IsOptional()
  @IsDateString()
  reportTo?: string | null;

  @ApiPropertyOptional({ type: String })
  @IsOptional()
  @IsDateString()
  visitDate?: string | null;

  @ApiPropertyOptional({ type: String })
  @IsOptional()
  @IsDateString()
  nextVisitDate?: string | null;

  @ApiPropertyOptional({ type: String })
  @IsOptional()
  @IsString()
  feedback?: string | null;

  @ApiPropertyOptional({ type: Boolean })
  @IsOptional()
  @IsBoolean()
  accepted?: boolean;
}
