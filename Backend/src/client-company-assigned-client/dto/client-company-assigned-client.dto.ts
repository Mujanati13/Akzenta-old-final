import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsNumber } from 'class-validator';

export class ClientCompanyAssignedClientDto {
  @ApiProperty()
  @IsNumber()
  @IsNotEmpty()
  id: number;
}
