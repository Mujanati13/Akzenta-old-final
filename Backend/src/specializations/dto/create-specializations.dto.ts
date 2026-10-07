import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsString, ValidateNested } from 'class-validator';
import { Type } from 'class-transformer';

class JobTypeRelationDto {
  @ApiProperty()
  @IsNotEmpty()
  id: number;
}

export class CreateSpecializationsDto {
  @ApiProperty({
    type: JobTypeRelationDto,
  })
  @ValidateNested()
  @Type(() => JobTypeRelationDto)
  jobType: JobTypeRelationDto;

  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  name: string;
}