import { PartialType } from '@nestjs/swagger';
import { CreateMerchandiserLanguagesDto } from './create-merchandiser-languages.dto';

export class UpdateMerchandiserLanguagesDto extends PartialType(CreateMerchandiserLanguagesDto) {}