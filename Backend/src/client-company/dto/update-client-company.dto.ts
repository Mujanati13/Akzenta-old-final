import { PartialType } from '@nestjs/swagger';
import { CreateClientCompanyDto } from './create-client-company.dto';

export class UpdateClientCompanyDto extends PartialType(
  CreateClientCompanyDto,
) {}
