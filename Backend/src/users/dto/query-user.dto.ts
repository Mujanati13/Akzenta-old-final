import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsNumber,
  IsOptional,
  IsString,
  ValidateNested,
} from 'class-validator';
import { Transform, Type, plainToInstance } from 'class-transformer';
import { User } from '../domain/user';
import { RoleDto } from '../../roles/dto/role.dto';
import { UserTypeDto } from '../../user-type/dto/user-type.dto';

export class FilterUserDto {
  @ApiPropertyOptional({ type: [RoleDto] })
  @IsOptional()
  @ValidateNested({ each: true })
  @Type(() => RoleDto)
  roles?: RoleDto[] | null;

  @ApiPropertyOptional({ type: [UserTypeDto] })
  @IsOptional()
  @ValidateNested({ each: true })
  @Type(() => UserTypeDto)
  userTypes?: UserTypeDto[] | null;

  @ApiPropertyOptional({ 
    type: [String], 
    description: 'Filter by user type names (case insensitive)',
    example: ['akzente', 'client']
  })
  @IsOptional()
  @Transform(({ value }) => 
    Array.isArray(value) 
      ? value.map((v: string) => v.toLowerCase()) 
      : [value.toLowerCase()]
  )
  @IsString({ each: true })
  userTypeNames?: string[] | null;

  @ApiPropertyOptional({ 
    type: String,
    description: 'Search users by first name, last name, or full name (case insensitive)',
    example: 'john doe'
  })
  @IsOptional()
  @Transform(({ value }) => value?.toLowerCase().trim())
  @IsString()
  search?: string | null;

  @ApiPropertyOptional({ 
    type: String,
    description: 'Search by client company name (for favoriteClientCompanies or clientCompanies)',
    example: 'Company ABC'
  })
  @IsOptional()
  @Transform(({ value }) => value?.trim())
  @IsString()
  clientCompanySearch?: string | null;

  @ApiPropertyOptional({ 
    type: String,
    description: 'Search by project name',
    example: 'Project XYZ'
  })
  @IsOptional()
  @Transform(({ value }) => value?.trim())
  @IsString()
  projectSearch?: string | null;

  @ApiPropertyOptional({ 
    type: String,
    description: 'Search by user type with partial matching (akzente or client only)',
    example: 'akz'
  })
  @IsOptional()
  @Transform(({ value }) => value?.toLowerCase().trim())
  @IsString()
  userTypeSearch?: string | null;
}

export class SortUserDto {
  @ApiProperty()
  @Type(() => String)
  @IsString()
  orderBy: keyof User;

  @ApiProperty()
  @IsString()
  order: string;
}

export class QueryUserDto {
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
    value ? plainToInstance(FilterUserDto, JSON.parse(value)) : undefined,
  )
  @ValidateNested()
  @Type(() => FilterUserDto)
  filters?: FilterUserDto | null;

  @ApiPropertyOptional({ type: String })
  @IsOptional()
  @Transform(({ value }) => {
    if (!value) return undefined;
    const parsed = JSON.parse(value);
    // Handle both array and single object
    if (Array.isArray(parsed)) {
      return parsed.map((item: any) => plainToInstance(SortUserDto, item));
    }
    return [plainToInstance(SortUserDto, parsed)];
  })
  @ValidateNested({ each: true })
  @Type(() => SortUserDto)
  sort?: SortUserDto[] | null;
}
