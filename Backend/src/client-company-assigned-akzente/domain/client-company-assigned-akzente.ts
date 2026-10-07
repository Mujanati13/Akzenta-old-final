import { ApiProperty } from '@nestjs/swagger';
import { ClientCompany } from '../../client-company/domain/client-company';
import { Akzente } from '../../akzente/domain/akzente';

export class ClientCompanyAssignedAkzente {
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
