import { PartialType } from '@nestjs/swagger';
import { CreateProjectAssignedClientDto } from './create-project-assigned-client.dto';

export class UpdateProjectAssignedClientDto extends PartialType(
  CreateProjectAssignedClientDto,
) {}
