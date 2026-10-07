// Don't forget to use the class-validator decorators in the DTO properties.
// import { Allow } from 'class-validator';

import { PartialType } from '@nestjs/swagger';
import { CreateAkzenteFavoriteProjectDto } from './create-akzente-favorite-project.dto';

export class UpdateAkzenteFavoriteProjectDto extends PartialType(
  CreateAkzenteFavoriteProjectDto,
) {}
