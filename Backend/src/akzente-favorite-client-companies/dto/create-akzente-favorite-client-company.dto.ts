import { ApiProperty } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsNotEmpty, ValidateNested } from 'class-validator';
import { AkzenteDto } from '../../akzente/dto/akzente.dto';
import { ClientCompanyDto } from '../../client-company/dto/client-company.dto';

export class CreateAkzenteFavoriteClientCompanyDto {
  @ApiProperty({ type: () => AkzenteDto })
  @IsNotEmpty()
  @ValidateNested()
  @Type(() => AkzenteDto)
  akzente: AkzenteDto;

  @ApiProperty({ type: () => ClientCompanyDto })
  @IsNotEmpty()
  @ValidateNested()
  @Type(() => ClientCompanyDto)
  clientCompany: ClientCompanyDto;
}
