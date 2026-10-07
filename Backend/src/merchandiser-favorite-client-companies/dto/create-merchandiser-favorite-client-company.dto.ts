import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsNumber } from 'class-validator';

export class MerchandiserRefDto {
  @ApiProperty({
    type: Number,
  })
  @IsNumber()
  @IsNotEmpty()
  id: number;
}

export class ClientCompanyRefDto {
  @ApiProperty({
    type: Number,
  })
  @IsNumber()
  @IsNotEmpty()
  id: number;
}

export class CreateMerchandiserFavoriteClientCompanyDto {
  @ApiProperty({
    type: () => MerchandiserRefDto,
  })
  @IsNotEmpty()
  merchandiser: MerchandiserRefDto;

  @ApiProperty({
    type: () => ClientCompanyRefDto,
  })
  @IsNotEmpty()
  clientCompany: ClientCompanyRefDto;
}
