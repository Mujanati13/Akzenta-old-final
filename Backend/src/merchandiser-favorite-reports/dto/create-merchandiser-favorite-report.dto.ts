import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, ValidateNested } from 'class-validator';
import { Type } from 'class-transformer';

class ReportRelationDto {
  @ApiProperty()
  @IsNotEmpty()
  id: number;
}

class MerchandiserRelationDto {
  @ApiProperty()
  @IsNotEmpty()
  id: number;
}

export class CreateMerchandiserFavoriteReportDto {
  @ApiProperty({
    type: ReportRelationDto,
  })
  @ValidateNested()
  @Type(() => ReportRelationDto)
  report: ReportRelationDto;

  @ApiProperty({
    type: MerchandiserRelationDto,
  })
  @ValidateNested()
  @Type(() => MerchandiserRelationDto)
  merchandiser: MerchandiserRelationDto;
}