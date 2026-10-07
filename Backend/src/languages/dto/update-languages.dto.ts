import { PartialType } from '@nestjs/swagger';
import { CreateLanguagesDto } from './create-languages.dto';

export class UpdateLanguagesDto extends PartialType(CreateLanguagesDto) {}