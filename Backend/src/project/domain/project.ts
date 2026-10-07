import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { ClientCompany } from '../../client-company/domain/client-company';
import { Question } from '../../question/domain/question';
import { Photo } from '../../photo/domain/photo';
import { AdvancedPhoto } from '../../advanced-photo/domain/advanced-photo';

export class Project {
  @ApiProperty({
    type: Number,
  })
  id: number;

  @ApiProperty({
    type: String,
  })
  name: string;

  @ApiProperty({
    type: Date,
    nullable: true,
  })
  startDate?: Date | null;

  @ApiProperty({
    type: Date,
    nullable: true,
  })
  endDate?: Date | null;

  @ApiProperty({
    type: Boolean,
  })
  isSpecCompliantEnabled: boolean;

  @ApiPropertyOptional({
    type: String,
    nullable: true,
  })
  feedback?: string | null;

  @ApiProperty({
    type: () => ClientCompany,
  })
  clientCompany: ClientCompany;

  @ApiPropertyOptional({
    type: () => [Question],
  })
  questions?: Question[];

  @ApiPropertyOptional({
    type: () => [Photo],
  })
  photos?: Photo[];

  @ApiPropertyOptional({
    type: () => [AdvancedPhoto],
  })
  advancedPhotos?: AdvancedPhoto[];

  @ApiPropertyOptional({
    type: String,
    nullable: true,
    description: 'Image naming pattern for all branches, e.g. Customer_Project_Branch_Date_Before1',
  })
  photoImageNamePattern?: string | null;

  @ApiProperty()
  createdAt: Date;

  @ApiProperty()
  updatedAt: Date;
}
