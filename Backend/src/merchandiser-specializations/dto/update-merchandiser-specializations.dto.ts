import { PartialType } from '@nestjs/swagger';
import { CreateMerchandiserSpecializationsDto } from './create-merchandiser-specializations.dto';

export class UpdateMerchandiserSpecializationsDto extends PartialType(CreateMerchandiserSpecializationsDto) {}