// Don't forget to use the class-validator decorators in the DTO properties.
// import { Allow } from 'class-validator';

import { PartialType } from '@nestjs/swagger';
import { CreateAkzenteFavoriteMerchandiserDto } from './create-akzente-favorite-merchandiser.dto';

export class UpdateAkzenteFavoriteMerchandiserDto extends PartialType(
  CreateAkzenteFavoriteMerchandiserDto,
) {}
