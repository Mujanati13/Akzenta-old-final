import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Project } from '../../project/domain/project';
import { ClientCompany } from '../../client-company/domain/client-company';
import { Merchandiser } from '../../merchandiser/domain/merchandiser';
import { Branch } from '../../branch/domain/branch';
import { ReportStatus } from '../../report-status/domain/status';
import { Answer } from '../../answer/domain/answer';
import { Conversation } from '../../conversation/domain/conversation';
import { UploadedAdvancedPhoto } from '../../uploaded-advanced-photos/domain/uploaded-advanced-photo';

export class Report {
  @ApiProperty({
    type: Number,
  })
  id: number;

  @ApiProperty({
    type: () => Project,
  })
  project: Project;

  @ApiProperty({
    type: () => ReportStatus,
  })
  status: ReportStatus;

  @ApiProperty({
    type: () => ClientCompany,
  })
  clientCompany: ClientCompany;

  @ApiPropertyOptional({
    type: () => Merchandiser,
  })
  merchandiser?: Merchandiser | null;

  @ApiProperty({
    type: () => Branch,
  })
  branch: Branch;

  @ApiPropertyOptional({
    type: String,
  })
  street?: string | null;

  @ApiPropertyOptional({
    type: String,
  })
  zipCode?: string | null;

  @ApiPropertyOptional({
    type: Date,
  })
  plannedOn?: Date | null;

  @ApiPropertyOptional({
    type: String,
  })
  note?: string | null;

  @ApiPropertyOptional({
    type: Date,
  })
  reportTo?: Date | null;

  @ApiPropertyOptional({
    type: Date,
  })
  visitDate?: Date | null;

  @ApiPropertyOptional({
    type: Date,
  })
  nextVisitDate?: Date | null;

  @ApiPropertyOptional({
    type: String,
  })
  feedback?: string | null;



  @ApiPropertyOptional({
    type: () => [Answer],
  })
  answers?: Answer[];

  @ApiPropertyOptional({
    type: () => Conversation,
  })
  conversation?: Conversation;

  @ApiPropertyOptional({
    type: () => [UploadedAdvancedPhoto],
  })
  uploadedAdvancedPhotos?: UploadedAdvancedPhoto[];

  @ApiPropertyOptional({
    type: Boolean,
    description: 'Whether this report is favorited by the current user',
  })
  isFavorite?: boolean;

  @ApiProperty()
  createdAt: Date;

  @ApiPropertyOptional({
    type: Boolean,
    description: 'Whether the report has been accepted by the merchandiser',
  })
  accepted?: boolean;

  @ApiProperty()
  updatedAt: Date;
}
