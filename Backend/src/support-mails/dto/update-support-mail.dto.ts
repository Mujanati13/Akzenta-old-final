import { PartialType } from '@nestjs/swagger';
import { CreateSupportMailDto } from './create-support-mail.dto';

export class UpdateSupportMailDto extends PartialType(CreateSupportMailDto) {}

