import { ApiProperty } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsNotEmpty, ValidateNested, IsString, IsOptional } from 'class-validator';
import { ClientCompanyDto } from '../../client-company/dto/client-company.dto';
import { CitiesRefDto } from '../../cities/dto/cities-ref.dto';

export class CreateBranchDto {
  @ApiProperty({ type: String })
  @IsNotEmpty()
  @IsString()
  name: string;

  @ApiProperty({ type: String, required: false })
  @IsOptional()
  @IsString()
  branchNumber?: string | null;

  @ApiProperty({ type: String })
  @IsOptional()
  @IsString()
  street?: string | null;

  @ApiProperty({ type: String })
  @IsOptional()
  @IsString()
  zipCode?: string | null;

  @ApiProperty({ type: String })
  @IsOptional()
  @IsString()
  phone?: string | null;

  @ApiProperty({ type: () => ClientCompanyDto })
  @IsNotEmpty()
  @ValidateNested()
  @Type(() => ClientCompanyDto)
  client: ClientCompanyDto;

  @ApiProperty({ type: () => CitiesRefDto, required: false })
  @IsOptional()
  @ValidateNested()
  @Type(() => CitiesRefDto)
  city?: CitiesRefDto | null;
}
