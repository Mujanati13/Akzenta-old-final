import { ApiProperty } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsNotEmpty, ValidateNested } from 'class-validator';
import { AkzenteDto } from '../../akzente/dto/akzente.dto';
import { MerchandiserDto } from '../../merchandiser/dto/merchandiser.dto';

export class CreateAkzenteFavoriteMerchandiserDto {
  @ApiProperty({ type: () => AkzenteDto })
  @IsNotEmpty()
  @ValidateNested()
  @Type(() => AkzenteDto)
  akzente: AkzenteDto;

  @ApiProperty({ type: () => MerchandiserDto })
  @IsNotEmpty()
  @ValidateNested()
  @Type(() => MerchandiserDto)
  merchandiser: MerchandiserDto;
}