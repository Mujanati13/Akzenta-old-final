import { PartialType } from '@nestjs/swagger';
import { CreateAkzenteDto } from './create-akzente.dto';

export class UpdateAkzenteDto extends PartialType(CreateAkzenteDto) {}
