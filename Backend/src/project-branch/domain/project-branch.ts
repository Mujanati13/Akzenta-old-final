import { ApiProperty } from '@nestjs/swagger';
import { Project } from '../../project/domain/project';
import { Branch } from '../../branch/domain/branch';

export class ProjectBranch {
  @ApiProperty({
    type: Number,
  })
  id: number;

  @ApiProperty({
    type: () => Project,
  })
  project: Project;

  @ApiProperty({
    type: () => Branch,
  })
  branch: Branch;

  @ApiProperty()
  createdAt: Date;

  @ApiProperty()
  updatedAt: Date;
}
