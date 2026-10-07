import { ApiProperty } from '@nestjs/swagger';
import { FileType } from '../../files/domain/file';

export class ClientCompany {
  @ApiProperty({
    type: Number,
  })
  id: number;

  @ApiProperty({
    type: () => FileType,
  })
  logo?: FileType | null;

  @ApiProperty({
    type: String,
  })
  name: string;

  @ApiProperty({
    type: Boolean,
    description: 'Whether this company is favorited by the current user',
  })
  isFavorite?: boolean;

  @ApiProperty()
  createdAt: Date;

  @ApiProperty()
  updatedAt: Date;
}
