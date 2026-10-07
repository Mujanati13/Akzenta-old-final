import { ApiProperty } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsNotEmpty, ValidateNested } from 'class-validator';
import { AkzenteDto } from '../../akzente/dto/akzente.dto';
import { ProjectDto } from '../../project/dto/project.dto';

export class CreateProjectAssignedAkzenteDto {
  @ApiProperty({ type: () => AkzenteDto })
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
