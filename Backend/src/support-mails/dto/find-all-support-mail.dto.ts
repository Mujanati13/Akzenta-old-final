import { ApiProperty } from '@nestjs/swagger';
import { SupportMail } from '../domain/support-mail';

export class FindAllSupportMailDto {
  @ApiProperty({ type: () => SupportMail, isArray: true })
  data: SupportMail[];
}

