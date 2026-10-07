import { PartialType } from '@nestjs/swagger';
import { CreateMerchandiserFilesDto } from './create-merchandiser-files.dto';

export class UpdateMerchandiserFilesDto extends PartialType(CreateMerchandiserFilesDto) {}