import { ApiProperty } from '@nestjs/swagger';
import { Merchandiser } from '../../merchandiser/domain/merchandiser';
import { JobTypes } from '../../job-types/domain/job-types';

export class MerchandiserJobTypes {
  @ApiProperty({
    type: Number,
  })
  id: number;

  @ApiProperty({
    type: () => Merchandiser,
  })
  merchandiser: Merchandiser;

  @ApiProperty({
    type: () => JobTypes,
  })
  jobType: JobTypes;

  @ApiProperty({
    type: String,
    nullable: true,
  })
  comment?: string | null;
}