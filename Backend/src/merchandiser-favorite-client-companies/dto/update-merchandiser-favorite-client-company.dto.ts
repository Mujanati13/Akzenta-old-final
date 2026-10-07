import { PartialType } from '@nestjs/swagger';
import { CreateMerchandiserFavoriteClientCompanyDto } from './create-merchandiser-favorite-client-company.dto';

export class UpdateMerchandiserFavoriteClientCompanyDto extends PartialType(
  CreateMerchandiserFavoriteClientCompanyDto,
) {}
