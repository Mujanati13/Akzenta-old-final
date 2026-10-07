import { ApiProperty } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsNotEmpty, ValidateNested } from 'class-validator';
import { AkzenteDto } from '../../akzente/dto/akzente.dto';
import { ReportDto } from '../../report/dto/report.dto';

export class CreateAkzenteFavoriteReportDto {
  @ApiProperty({ 
    type: () => AkzenteDto,
    description: 'Akzente object with id representing the user ID'
  })
  @IsNotEmpty()
  @ValidateNested()
  @Type(() => AkzenteDto)
  akzente: AkzenteDto;

  @ApiProperty({ type: () => ReportDto })
  @IsNotEmpty()
  @ValidateNested()
  @Type(() => ReportDto)
  report: ReportDto;
}
