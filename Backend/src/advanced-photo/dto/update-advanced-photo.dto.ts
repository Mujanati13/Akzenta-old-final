import { PartialType } from '@nestjs/swagger';
import { CreateAdvancedPhotoDto } from './create-advanced-photo.dto';

export class UpdateAdvancedPhotoDto extends PartialType(
  CreateAdvancedPhotoDto,
) {}
