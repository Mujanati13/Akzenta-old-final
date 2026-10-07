import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsString, IsNumber, IsArray, IsDateString, IsBoolean } from 'class-validator';

export class CityRefDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsNumber()
  id?: number;
}

export class JobTypeDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsNumber()
  id?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsNumber()
  jobTypeId?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  name?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  comment?: string;
}

export class ContractualDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsNumber()
  id?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  name?: string;
}

export class SpecializationDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  name?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  jobTypeName?: string;
}

export class EducationDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsNumber()
  id?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  institution?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  qualification?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsDateString()
  graduationDate?: string;
}

export class ReferenceDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsNumber()
  id?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  company?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  activity?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  industry?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsDateString()
  fromDate?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsDateString()
  toDate?: string;
}

export class LanguageDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsNumber()
  id?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsNumber()
  languageId?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsNumber()
  levelId?: number;

  @ApiPropertyOptional()
  @IsOptional()
  language?: {
    id: number;
    name: string;
  };

  @ApiPropertyOptional()
  @IsOptional()
  level?: {
    id: number;
    name: string;
    code?: string;
  };
}

export class UpdateMerchandiserDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  firstName?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  lastName?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  dateOfBirth?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  phone?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  email?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  forceEmailUpdate?: boolean;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  website?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  address?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  postalCode?: string;

  @ApiPropertyOptional()
  @IsOptional()
  city?: CityRefDto;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  cityName?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  country?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  deliveryAddress?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  deliveryPostalCode?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  deliveryCountry?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  secondaryResidence?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  secondaryPostalCode?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  secondaryCountry?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  status?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  taxId?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  taxNumber?: string;

  @ApiPropertyOptional({ type: [JobTypeDto] })
  @IsOptional()
  @IsArray()
  jobTypes?: JobTypeDto[];

  @ApiPropertyOptional({ type: [ContractualDto] })
  @IsOptional()
  @IsArray()
  contractuals?: ContractualDto[];

  @ApiPropertyOptional({ type: [SpecializationDto] })
  @IsOptional()
  @IsArray()
  specializations?: SpecializationDto[];

  @ApiPropertyOptional({ type: [EducationDto] })
  @IsOptional()
  @IsArray()
  education?: EducationDto[];

  @ApiPropertyOptional({ type: [ReferenceDto] })
  @IsOptional()
  @IsArray()
  references?: ReferenceDto[];

  @ApiPropertyOptional({ type: [LanguageDto] })
  @IsOptional()
  @IsArray()
  languages?: LanguageDto[];
}
