import { PartialType } from '@nestjs/swagger';
import { CreateProjectAssignedAkzenteDto } from './create-project-assigned-akzente.dto';

export class UpdateProjectAssignedAkzenteDto extends PartialType(
  CreateProjectAssignedAkzenteDto,
) {}
