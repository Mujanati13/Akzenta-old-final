import { ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsNumber,
  IsOptional,
  IsString,
  ValidateNested,
  IsArray,
} from 'class-validator';
import { Transform, Type, plainToInstance } from 'class-transformer';
import { Merchandiser } from '../domain/merchandiser';

export class FilterMerchandiserDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  search?: string; // Search in user's name, email, or website

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  location?: string; // Search by region name or zipCode

  // Keep ID-based filters for backwards compatibility
  @ApiPropertyOptional()
  @IsOptional()
  @IsArray()
  @IsNumber({}, { each: true })
  @Type(() => Number)
  jobTypeIds?: number[]; // Filter by job type IDs

  @ApiPropertyOptional()
  @IsOptional()
  @IsArray()
  @IsNumber({}, { each: true })
  @Type(() => Number)
  cityIds?: number[]; // Filter by cities

  @ApiPropertyOptional()
  @IsOptional()
  @IsArray()
  @IsNumber({}, { each: true })
  @Type(() => Number)
  countryIds?: number[]; // Filter by countries

  @ApiPropertyOptional()
  @IsOptional()
  @IsArray()
  @IsNumber({}, { each: true })
  @Type(() => Number)
  languageIds?: number[]; // Filter by language IDs

  @ApiPropertyOptional()
  @IsOptional()
  @IsArray()
  @IsNumber({}, { each: true })
  @Type(() => Number)
  specializationIds?: number[]; // Filter by specialization IDs

  // Add text-based filters
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  qualifications?: string; // Search in job type names

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  specializations?: string; // Search in specialization names

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  languages?: string; // Search in language names

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  nationality?: string; // Filter by nationality

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  ageRange?: string; // e.g., "18-30", "31-45", "46-60", "60+"

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  gender?: string; // Filter by gender

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  hasWebsite?: string; // "true" or "false"

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  status?: string; // Custom status filter

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  clientAssignment?: string; // Custom client assignment filter

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  customFilter?: string; // For additional custom filtering
}

export class SortMerchandiserDto {
  @ApiPropertyOptional()
  @Type(() => String)
  @IsString()
  orderBy: keyof Merchandiser;

  @ApiPropertyOptional()
  @IsString()
  order: string;
}

export class QueryMerchandiserDto {
  @ApiPropertyOptional()
  @Transform(({ value }) => (value ? Number(value) : 1))
  @IsNumber()
  @IsOptional()
  page?: number;

  @ApiPropertyOptional()
  @Transform(({ value }) => (value ? Number(value) : 10))
  @IsNumber()
  @IsOptional()
  limit?: number;

  @ApiPropertyOptional({ type: String })
  @IsOptional()
  @Transform(({ value }) =>
    value ? plainToInstance(FilterMerchandiserDto, JSON.parse(value)) : undefined,
  )
  @ValidateNested()
  @Type(() => FilterMerchandiserDto)
  filters?: FilterMerchandiserDto | null;

  @ApiPropertyOptional({ type: String })
  @IsOptional()
  @Transform(({ value }) => {
    return value ? plainToInstance(SortMerchandiserDto, JSON.parse(value)) : undefined;
  })
  @ValidateNested({ each: true })
  @Type(() => SortMerchandiserDto)
  sort?: SortMerchandiserDto[] | null;
}