import { PartialType } from '@nestjs/swagger';
import { CreateClientCompanyAssignedAkzenteDto } from './create-client-company-assigned-akzente.dto';

export class UpdateClientCompanyAssignedAkzenteDto extends PartialType(
  CreateClientCompanyAssignedAkzenteDto,
) {}
