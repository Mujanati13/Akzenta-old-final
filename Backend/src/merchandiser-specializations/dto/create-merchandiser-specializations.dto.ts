import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, ValidateNested } from 'class-validator';
import { Type } from 'class-transformer';

class MerchandiserRelationDto {
  @ApiProperty()
  @IsNotEmpty()
  id: number;
}

class SpecializationRelationDto {
  @ApiProperty()
  @IsNotEmpty()
  id: number;
}

export class CreateMerchandiserSpecializationsDto {
  @ApiProperty({
    type: MerchandiserRelationDto,
  })
  @ValidateNested()
  @Type(() => MerchandiserRelationDto)
  merchandiser: MerchandiserRelationDto;

  @ApiProperty({
    type: SpecializationRelationDto,
  })
  @ValidateNested()
  @Type(() => SpecializationRelationDto)
  specialization: SpecializationRelationDto;
}