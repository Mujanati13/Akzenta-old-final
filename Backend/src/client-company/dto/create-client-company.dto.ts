import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  IsNotEmpty,
  ValidateNested,
  IsString,
  IsOptional,
} from 'class-validator';
import { FileDto } from '../../files/dto/file.dto';

export class CreateClientCompanyDto {
  @ApiPropertyOptional({ type: () => FileDto })
  @IsOptional()
  @ValidateNested()
  @Type(() => FileDto)
  logo?: FileDto | null;

  @ApiProperty({ type: String })
  @IsNotEmpty()
  @IsString()
  name: string;
}
