import { PartialType } from '@nestjs/swagger';
import { CreateReportStatusDto } from './create-status.dto';

export class UpdateReportStatusDto extends PartialType(CreateReportStatusDto) {}
