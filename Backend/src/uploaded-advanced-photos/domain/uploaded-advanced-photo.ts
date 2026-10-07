import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { AdvancedPhoto } from '../../advanced-photo/domain/advanced-photo';
import { FileType } from '../../files/domain/file';
import { Report } from '../../report/domain/report';

export class UploadedAdvancedPhoto {
  @ApiProperty({
    type: Number,
  })
  id: number;

  @ApiProperty({
    type: () => AdvancedPhoto,
  })
  advancedPhoto: AdvancedPhoto;

  @ApiProperty({
    type: () => FileType,
  })
  file: FileType;

  @ApiProperty({
    type: () => Report,
  })
  report: Report;

  @ApiProperty({
    type: String,
    required: false,
  })
  label?: string | null;

  @ApiPropertyOptional({ enum: ['before', 'after'] })
  beforeAfterType?: 'before' | 'after' | null;

  @ApiPropertyOptional({ type: Number })
  order?: number;

  @ApiProperty()
  createdAt: Date;

  @ApiProperty()
  updatedAt: Date;
}
