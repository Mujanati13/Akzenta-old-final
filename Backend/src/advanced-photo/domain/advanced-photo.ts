import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Project } from '../../project/domain/project';

export class AdvancedPhoto {
  @ApiProperty({
    type: Number,
  })
  id: number;

  @ApiProperty({
    type: () => Project,
  })
  project: Project;

  @ApiProperty({
    type: [String],
  })
  labels: string[];

  @ApiProperty({
    type: Boolean,
    nullable: true,
  })
  isBeforeAfter?: boolean | null;

  @ApiProperty({
    type: Boolean,
  })
  isVisibleInReport: boolean;

  @ApiPropertyOptional({
    type: Number,
    nullable: true,
    description: 'Max before images per report slot; null = unlimited',
  })
  beforeImageCount?: number | null;

  @ApiPropertyOptional({
    type: Number,
    nullable: true,
    description: 'Max after images per report slot; null = unlimited',
  })
  afterImageCount?: number | null;

  @ApiProperty()
  createdAt: Date;

  @ApiProperty()
  updatedAt: Date;
}
