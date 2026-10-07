import { PartialType } from '@nestjs/swagger';
import { CreateContractualsDto } from './create-contractuals.dto';

export class UpdateContractualsDto extends PartialType(CreateContractualsDto) {}