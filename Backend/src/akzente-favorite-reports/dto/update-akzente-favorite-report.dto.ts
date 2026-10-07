// Don't forget to use the class-validator decorators in the DTO properties.
// import { Allow } from 'class-validator';

import { PartialType } from '@nestjs/swagger';
import { CreateAkzenteFavoriteReportDto } from './create-akzente-favorite-report.dto';

export class UpdateAkzenteFavoriteReportDto extends PartialType(
  CreateAkzenteFavoriteReportDto,
) {}
