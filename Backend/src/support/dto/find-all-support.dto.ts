import { ApiProperty } from '@nestjs/swagger';
import { Support } from '../domain/support';

export class FindAllSupportDto {
  @ApiProperty({ type: () => Support, isArray: true })
  data: Support[];
}

