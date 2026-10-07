import { PartialType } from '@nestjs/swagger';
import { CreateMerchandiserJobTypesDto } from './create-merchandiser-job-types.dto';

export class UpdateMerchandiserJobTypesDto extends PartialType(CreateMerchandiserJobTypesDto) {}