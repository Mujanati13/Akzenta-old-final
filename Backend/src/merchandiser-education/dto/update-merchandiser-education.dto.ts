import { PartialType } from '@nestjs/swagger';
import { CreateMerchandiserEducationDto } from './create-merchandiser-education.dto';

export class UpdateMerchandiserEducationDto extends PartialType(CreateMerchandiserEducationDto) {}