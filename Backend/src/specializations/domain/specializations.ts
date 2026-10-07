import { ApiProperty } from '@nestjs/swagger';
import { JobTypes } from '../../job-types/domain/job-types';

export class Specializations {
  @ApiProperty({
    type: Number,
  })
  id: number;

  @ApiProperty({
    type: () => JobTypes,
  })
  jobType: JobTypes;

  @ApiProperty({
    type: String,
  })
  name: string;

  @ApiProperty({
    type: Date,
  })
  createdAt: Date;

  @ApiProperty({
    type: Date,
  })
  updatedAt: Date;
}