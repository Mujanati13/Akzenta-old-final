import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsNumber } from 'class-validator';

export class ClientCompanyAssignedAkzenteDto {
  @ApiProperty()
  @IsNumber()
  @IsNotEmpty()
  id: number;
}
