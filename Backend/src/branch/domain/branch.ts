import { ApiProperty } from '@nestjs/swagger';
import { ClientCompany } from '../../client-company/domain/client-company';
import { Cities } from '../../cities/domain/cities';

export class Branch {
  @ApiProperty({
    type: Number,
  })
  id: number;

  @ApiProperty({
    type: String,
  })
  name: string;

  @ApiProperty({
    type: String,
  })
  branchNumber?: string | null;

  @ApiProperty({
    type: String,
  })
  street?: string | null;

  @ApiProperty({
    type: String,
  })
  zipCode?: string | null;

  @ApiProperty({
    type: () => ClientCompany,
  })
  client: ClientCompany;

  @ApiProperty({
    type: () => Cities,
    required: false,
  })
  city?: Cities | null;

  @ApiProperty({
    type: String,
  })
  phone?: string | null;

  @ApiProperty()
  createdAt: Date;

  @ApiProperty()
  updatedAt: Date;
}
