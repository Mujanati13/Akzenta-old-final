// Don't forget to use the class-validator decorators in the DTO properties.
// import { Allow } from 'class-validator';

import { PartialType } from '@nestjs/swagger';
import { CreateClientFavoriteProjectDto } from './create-client-favorite-project.dto';

export class UpdateClientFavoriteProjectDto extends PartialType(
  CreateClientFavoriteProjectDto,
) {}
