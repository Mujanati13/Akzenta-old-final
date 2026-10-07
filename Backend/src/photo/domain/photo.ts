import { ApiProperty } from '@nestjs/swagger';
import { Project } from '../../project/domain/project';

export class Photo {
  @ApiProperty({
    type: Number,
  })
  id: number;

  @ApiProperty({
    type: () => Project,
  })
  project: Project;

  @ApiProperty({
    type: Number,
  })
  order: number;

  @ApiProperty({
    type: Boolean,
    nullable: true,
  })
  isBeforeAfter?: boolean | null;

  @ApiProperty({
    type: Boolean,
  })
  isVisibleInReport: boolean;

  @ApiProperty()
  createdAt: Date;

  @ApiProperty()
  updatedAt: Date;
}
