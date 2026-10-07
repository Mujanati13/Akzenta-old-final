import { ApiProperty } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsNotEmpty, ValidateNested } from 'class-validator';
import { ClientDto } from '../../client/dto/client.dto';
import { ReportDto } from '../../report/dto/report.dto';

export class CreateClientFavoriteReportDto {
  @ApiProperty({ 
    type: () => ClientDto,
    description: 'Client object with id representing the user ID'
  })
  @IsNotEmpty()
  @ValidateNested()
  @Type(() => ClientDto)
  client: ClientDto;

  @ApiProperty({ type: () => ReportDto })
  @IsNotEmpty()
  @ValidateNested()
  @Type(() => ReportDto)
  report: ReportDto;
}
