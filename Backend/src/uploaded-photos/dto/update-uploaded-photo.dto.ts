import { PartialType } from '@nestjs/swagger';
import { CreateUploadedPhotoDto } from './create-uploaded-photo.dto';

export class UpdateUploadedPhotoDto extends PartialType(
  CreateUploadedPhotoDto,
) {}
