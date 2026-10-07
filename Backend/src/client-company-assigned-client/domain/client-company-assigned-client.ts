import { ApiProperty } from '@nestjs/swagger';
import { Client } from '../../client/domain/client';
import { ClientCompany } from '../../client-company/domain/client-company';

export class ClientCompanyAssignedClient {
  @ApiProperty({
    type: Number,
  })
  id: number;

  @ApiProperty({
    type: () => Client,
  })
  client: Client;

  @ApiProperty({
    type: () => ClientCompany,
  })
  clientCompany: ClientCompany;

  @ApiProperty()
  createdAt: Date;

  @ApiProperty()
  updatedAt: Date;
}
