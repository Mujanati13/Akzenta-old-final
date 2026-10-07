// Don't forget to use the class-validator decorators in the DTO properties.
// import { Allow } from 'class-validator';

import { PartialType } from '@nestjs/swagger';
import { CreateAkzenteFavoriteClientDto } from './create-akzente-favorite-client.dto';

export class UpdateAkzenteFavoriteClientDto extends PartialType(
  CreateAkzenteFavoriteClientDto,
) {}
