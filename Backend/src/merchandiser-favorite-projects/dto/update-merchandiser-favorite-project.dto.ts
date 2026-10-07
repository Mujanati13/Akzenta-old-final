import { ApiProperty } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsNumber, IsObject, ValidateNested } from 'class-validator';
import { Merchandiser } from '../../merchandiser/domain/merchandiser';
import { Project } from '../../project/domain/project';

export class UpdateMerchandiserFavoriteProjectDto {
  @ApiProperty({
    type: () => Merchandiser,
  })
  @IsObject()
  @ValidateNested()
  @Type(() => Merchandiser)
  merchandiser: Merchandiser;

  @ApiProperty({
    type: () => Project,
  })
  @IsObject()
  @ValidateNested()
  @Type(() => Project)
  project: Project;
}
