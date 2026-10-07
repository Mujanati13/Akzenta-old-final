import { PartialType } from '@nestjs/swagger';
import { CreateCitiesDto } from './create-cities.dto';

export class UpdateCitiesDto extends PartialType(CreateCitiesDto) {}