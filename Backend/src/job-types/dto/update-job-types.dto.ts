import { PartialType } from '@nestjs/swagger';
import { CreateJobTypesDto } from './create-job-types.dto';

export class UpdateJobTypesDto extends PartialType(CreateJobTypesDto) {}