// Don't forget to use the class-validator decorators in the DTO properties.
// import { Allow } from 'class-validator';

import { PartialType } from '@nestjs/swagger';
import { CreateCountriesDto } from './create-countries.dto';

export class UpdateCountriesDto extends PartialType(CreateCountriesDto) {}
