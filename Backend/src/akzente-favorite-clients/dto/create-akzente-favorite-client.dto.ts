import { ApiProperty } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsNotEmpty, ValidateNested } from 'class-validator';
import { AkzenteDto } from '../../akzente/dto/akzente.dto';
import { ClientDto } from '../../client/dto/client.dto';

export class CreateAkzenteFavoriteClientDto {
  @ApiProperty({ type: () => AkzenteDto })
  @IsNotEmpty()
  @ValidateNested()
  @Type(() => AkzenteDto)
  akzente: AkzenteDto;

  @ApiProperty({ type: () => ClientDto })
  @IsNotEmpty()
  @ValidateNested()
  @Type(() => ClientDto)
  client: ClientDto;
}