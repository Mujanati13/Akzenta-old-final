import { ApiProperty } from '@nestjs/swagger';
import { ClientCompany } from '../../client-company/domain/client-company';
import { Merchandiser } from '../../merchandiser/domain/merchandiser';

export class MerchandiserFavoriteClientCompany {
  @ApiProperty({
    type: Number,
  })
  id: number;

  @ApiProperty({
    type: () => Merchandiser,
  })
  merchandiser: Merchandiser;

  @ApiProperty({
    type: () => ClientCompany,
  })
  clientCompany: ClientCompany;

  @ApiProperty()
  createdAt: Date;

  @ApiProperty()
  updatedAt: Date;
}
