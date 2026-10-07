import { ApiProperty } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsNotEmpty, ValidateNested } from 'class-validator';
import { BranchDto } from '../../branch/dto/branch.dto';
import { ProjectDto } from '../../project/dto/project.dto';

export class CreateProjectBranchDto {
  @ApiProperty({ type: () => ProjectDto })
  @IsNotEmpty()
  @ValidateNested()
  @Type(() => ProjectDto)
  project: ProjectDto;

  @ApiProperty({ type: () => BranchDto })
  @IsNotEmpty()
  @ValidateNested()
  @Type(() => BranchDto)
  branch: BranchDto;
}
