import { ApiProperty } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsNotEmpty, IsObject, ValidateNested } from 'class-validator';
import { MerchandiserDto } from '../../merchandiser/dto/merchandiser.dto';
import { ProjectDto } from '../../project/dto/project.dto';

export class CreateMerchandiserFavoriteProjectDto {
  @ApiProperty({ 
    type: () => MerchandiserDto,
    description: 'Merchandiser object with id representing the user ID'
  })
  @IsNotEmpty()
  @ValidateNested()
  @Type(() => MerchandiserDto)
  merchandiser: MerchandiserDto;

  @ApiProperty({ type: () => ProjectDto })
  @IsNotEmpty()
  @ValidateNested()
  @Type(() => ProjectDto)
  project: ProjectDto;
}
