import { PartialType } from '@nestjs/swagger';
import { CreateClientCompanyAssignedClientDto } from './create-client-company-assigned-client.dto';

export class UpdateClientCompanyAssignedClientDto extends PartialType(
  CreateClientCompanyAssignedClientDto,
) {}
