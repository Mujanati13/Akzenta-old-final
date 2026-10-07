import { PartialType } from '@nestjs/swagger';
import { CreateSpecializationsDto } from './create-specializations.dto';

export class UpdateSpecializationsDto extends PartialType(CreateSpecializationsDto) {}