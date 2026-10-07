import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsNotEmpty, ValidateNested, IsOptional, IsEnum } from 'class-validator';
import { Type } from 'class-transformer';
import { MerchandiserFileType } from '../domain/merchandiser-files';

class MerchandiserRelationDto {
  @ApiProperty()
  @IsNotEmpty()
  id: number;
}

class FileRelationDto {
  @ApiProperty()
  @IsNotEmpty()
  id: string;
}

export class CreateMerchandiserFilesDto {
  @ApiProperty({
    type: MerchandiserRelationDto,
  })
  @ValidateNested()
  @Type(() => MerchandiserRelationDto)
  merchandiser: MerchandiserRelationDto;

  @ApiProperty({
    type: FileRelationDto,
  })
  @ValidateNested()
  @Type(() => FileRelationDto)
  file: FileRelationDto;

  @ApiPropertyOptional({
    enum: MerchandiserFileType,
    enumName: 'MerchandiserFileType',
  })
  @IsOptional()
  @IsEnum(MerchandiserFileType)
  type?: MerchandiserFileType;

  @ApiPropertyOptional()
  @IsOptional()
  name?: string;
}