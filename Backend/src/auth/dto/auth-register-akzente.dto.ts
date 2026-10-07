import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Transform, Type } from 'class-transformer';
import {
  IsEmail,
  IsNotEmpty,
  IsString,
  IsEnum,
  IsArray,
  ValidateNested,
  MinLength,
  IsOptional,
  IsBoolean,
} from 'class-validator';
import { lowerCaseTransformer } from '../../utils/transformers/lower-case.transformer';
import { GenderEnum } from '../../users/enums/gender.enum';
import { ClientCompanyDto } from '../../client-company/dto/client-company.dto';

export class AuthRegisterAkzenteDto {
  @ApiProperty({ example: 'akzente@example.com' })
  @Transform(lowerCaseTransformer)
  @IsEmail()
  @IsNotEmpty()
  email: string;

  @ApiPropertyOptional({
    deprecated: true,
    description: 'Ignored — passwords are always auto-generated and emailed on registration.',
  })
  @IsOptional()
  @IsString()
  @MinLength(6, { message: 'Password must be at least 6 characters' })
  password?: string;

  @ApiProperty({ example: 'John' })
  @IsNotEmpty()
  @IsString()
  firstName: string;

  @ApiProperty({ example: 'Doe' })
  @IsNotEmpty()
  @IsString()
  lastName: string;

  @ApiProperty({ enum: GenderEnum, example: GenderEnum.MALE })
  @IsNotEmpty()
  @IsEnum(GenderEnum)
  gender: GenderEnum;

  @ApiProperty({ example: '+1234567890', required: false })
  @IsOptional()
  @IsString()
  phone?: string;

  @ApiProperty({ 
    type: Boolean, 
    description: 'Indicates if the Akzente user is in sales',
    default: false,
    required: false 
  })
  @IsOptional()
  @IsBoolean()
  isSales?: boolean;

  @ApiProperty({ 
    type: [ClientCompanyDto],
    description: 'Favorite client companies for the Akzente user'
  })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => ClientCompanyDto)
  clientCompanies: ClientCompanyDto[];
}