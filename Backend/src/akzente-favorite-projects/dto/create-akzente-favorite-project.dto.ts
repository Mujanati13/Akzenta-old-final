import { ApiProperty } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsNotEmpty, ValidateNested } from 'class-validator';
import { AkzenteDto } from '../../akzente/dto/akzente.dto';
import { ProjectDto } from '../../project/dto/project.dto';

export class CreateAkzenteFavoriteProjectDto {
  @ApiProperty({ 
    type: () => AkzenteDto,
    description: 'Akzente object with id representing the user ID'
  })
  @IsNotEmpty()
  @ValidateNested()
  @Type(() => AkzenteDto)
  akzente: AkzenteDto;

  @ApiProperty({ type: () => ProjectDto })
  @IsNotEmpty()
  @ValidateNested()
  @Type(() => ProjectDto)
  project: ProjectDto;
}
