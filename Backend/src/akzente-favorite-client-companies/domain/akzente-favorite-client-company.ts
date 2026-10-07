import { ApiProperty } from '@nestjs/swagger';
import { Akzente } from '../../akzente/domain/akzente';
import { ClientCompany } from '../../client-company/domain/client-company';

export class AkzenteFavoriteClientCompany {
  @ApiProperty({
    type: Number,
  })
  id: number;

  @ApiProperty({
    type: () => Akzente,
  })
  akzente: Akzente;

  @ApiProperty({
    type: () => ClientCompany,
  })
  clientCompany: ClientCompany;

  @ApiProperty()
  createdAt: Date;

  @ApiProperty()
  updatedAt: Date;
}