import { ApiProperty } from '@nestjs/swagger';
import { Cities } from '../../cities/domain/cities';

export class Countries {
  @ApiProperty({
    type: () => String,
    nullable: true,
  })
  flag?: string | null;

  @ApiProperty({
    type: Object, // Specify Object for Swagger documentation
    description: 'A JSON object containing translations of the country name',
    example: {
      ar: 'المغرب',
      fr: 'Maroc',
      sp: 'Marruecos',
      en: 'Morocco',
    },
    nullable: false,
  })
  name: Record<string, string>;

  @ApiProperty({
    type: () => [Cities],
    nullable: true,
  })
  cities?: Cities[] | null;

  @ApiProperty({
    type: Number,
  })
  id: number;

  @ApiProperty()
  createdAt: Date;

  @ApiProperty()
  updatedAt: Date;
}
