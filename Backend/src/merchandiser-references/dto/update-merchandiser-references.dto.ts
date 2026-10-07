import { PartialType } from '@nestjs/swagger';
import { CreateMerchandiserReferencesDto } from './create-merchandiser-references.dto';

export class UpdateMerchandiserReferencesDto extends PartialType(CreateMerchandiserReferencesDto) {}