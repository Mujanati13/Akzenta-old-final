import { PartialType } from '@nestjs/swagger';
import { CreateProjectBranchDto } from './create-project-branch.dto';

export class UpdateProjectBranchDto extends PartialType(
  CreateProjectBranchDto,
) {}
