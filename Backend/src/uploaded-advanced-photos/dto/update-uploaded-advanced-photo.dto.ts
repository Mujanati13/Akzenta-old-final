import { PartialType } from '@nestjs/swagger';
import { CreateUploadedAdvancedPhotoDto } from './create-uploaded-advanced-photo.dto';

// beforeAfterType is inherited from CreateUploadedAdvancedPhotoDto
export class UpdateUploadedAdvancedPhotoDto extends PartialType(
  CreateUploadedAdvancedPhotoDto,
) {}
