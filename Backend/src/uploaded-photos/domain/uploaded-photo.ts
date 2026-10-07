import { ApiProperty } from '@nestjs/swagger';
import { Photo } from '../../photo/domain/photo';
import { FileType } from '../../files/domain/file';
import { Report } from '../../report/domain/report';

export class UploadedPhoto {
  @ApiProperty({
    type: Number,
  })
  id: number;

  @ApiProperty({
    type: () => Photo,
  })
  photo: Photo;

  @ApiProperty({
    type: () => FileType,
  })
  file: FileType;

  @ApiProperty({
    type: () => Report,
  })
  report: Report;

  @ApiProperty()
  createdAt: Date;

  @ApiProperty()
  updatedAt: Date;
}
