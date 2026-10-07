import { ApiProperty } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsNotEmpty, ValidateNested } from 'class-validator';
import { ClientDto } from '../../client/dto/client.dto';
import { ClientCompanyDto } from '../../client-company/dto/client-company.dto';

export class CreateClientCompanyAssignedClientDto {
  @ApiProperty({ type: () => ClientDto })
  @IsNotEmpty()
  @ValidateNested()
  @Type(() => ClientDto)
  client: ClientDto;

  @ApiProperty({ type: () => ClientCompanyDto })
  @IsNotEmpty()
  @ValidateNested()
  @Type(() => ClientCompanyDto)
  clientCompany: ClientCompanyDto;
}
