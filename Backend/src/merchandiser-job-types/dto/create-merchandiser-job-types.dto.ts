import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsNotEmpty, IsOptional, IsString, ValidateNested } from 'class-validator';
import { Type } from 'class-transformer';

class MerchandiserRelationDto {
  @ApiProperty()
  @IsNotEmpty()
  id: number;
}

class JobTypeRelationDto {
  @ApiProperty()
  @IsNotEmpty()
  id: number;
}

export class CreateMerchandiserJobTypesDto {
  @ApiProperty({
    type: MerchandiserRelationDto,
  })
  @ValidateNested()
  @Type(() => MerchandiserRelationDto)
  merchandiser: MerchandiserRelationDto;

  @ApiProperty({
    type: JobTypeRelationDto,
  })
  @ValidateNested()
  @Type(() => JobTypeRelationDto)
  jobType: JobTypeRelationDto;
  
  @ApiPropertyOptional({ type: String })
  @IsOptional()
  @IsString()
  comment?: string | null;
}