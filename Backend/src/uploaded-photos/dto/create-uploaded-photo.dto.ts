import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, ValidateNested } from 'class-validator';
import { Photo } from '../../photo/domain/photo';
import { FileType } from '../../files/domain/file';
import { ReportDto } from '../../report/dto/report.dto';
import { Type } from 'class-transformer';

export class CreateUploadedPhotoDto {

  @ApiProperty({ type: () => Photo })
  @IsNotEmpty()
  photo: Photo;

  @ApiProperty({ type: () => FileType })
  @IsNotEmpty()
  file: FileType;
  
  @ApiProperty({ type: () => ReportDto })
  @IsNotEmpty()
  @ValidateNested()
  @Type(() => ReportDto)
  report: ReportDto;
}
