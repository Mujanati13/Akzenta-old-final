import { ApiProperty } from '@nestjs/swagger';
import { Project } from '../../project/domain/project';
import { Merchandiser } from '../../merchandiser/domain/merchandiser';

export class MerchandiserFavoriteProject {
  @ApiProperty({
    type: Number,
  })
  id: number;

  @ApiProperty({
    type: () => Merchandiser,
  })
  merchandiser: Merchandiser;

  @ApiProperty({
    type: () => Project,
  })
  project: Project;

  @ApiProperty()
  createdAt: Date;

  @ApiProperty()
  updatedAt: Date;
}
