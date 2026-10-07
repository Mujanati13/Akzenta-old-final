import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Merchandiser } from '../../merchandiser/domain/merchandiser';
import { FileType } from '../../files/domain/file';

export enum MerchandiserFileType {
  PORTRAIT = 'portrait',
  FULL_BODY_SHOT = 'full_body_shot',
  RESUME = 'resume',
  ADDITIONAL_ATTACHMENTS = 'additional_attachments',
}

export class MerchandiserFiles {
  @ApiProperty({
    type: Number,
  })
  id: number;

  @ApiProperty({
    type: () => Merchandiser,
  })
  merchandiser: Merchandiser;

  @ApiProperty({
    type: () => FileType,
  })
  file: FileType;

  @ApiPropertyOptional({
    enum: MerchandiserFileType,
    enumName: 'MerchandiserFileType',
  })
  type?: MerchandiserFileType | null;

  @ApiPropertyOptional({
    type: String,
  })
  name?: string | null;

  @ApiProperty({
    type: Date,
  })
  createdAt: Date;

  @ApiProperty({
    type: Date,
  })
  updatedAt: Date;
}