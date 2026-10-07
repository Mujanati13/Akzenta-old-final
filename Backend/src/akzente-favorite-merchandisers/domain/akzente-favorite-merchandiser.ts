import { ApiProperty } from '@nestjs/swagger';
import { Akzente } from '../../akzente/domain/akzente';
import { Merchandiser } from '../../merchandiser/domain/merchandiser';

export class AkzenteFavoriteMerchandiser {
  @ApiProperty({
    type: Number,
  })
  id: number;

  @ApiProperty({
    type: () => Akzente,
  })
  akzente: Akzente;

  @ApiProperty({
    type: () => Merchandiser,
  })
  merchandiser: Merchandiser;

  @ApiProperty()
  createdAt: Date;

  @ApiProperty()
  updatedAt: Date;
}