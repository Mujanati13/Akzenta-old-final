import { ApiProperty } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsNotEmpty, ValidateNested } from 'class-validator';
import { ClientDto } from '../../client/dto/client.dto';
import { ProjectDto } from '../../project/dto/project.dto';

export class CreateProjectAssignedClientDto {
  @ApiProperty({ type: () => ClientDto })
  @IsNotEmpty()
  @ValidateNested()
  @Type(() => ClientDto)
  client: ClientDto;

  @ApiProperty({ type: () => ProjectDto })
  @IsNotEmpty()
  @ValidateNested()
  @Type(() => ProjectDto)
  project: ProjectDto;
}
