import { ApiProperty } from '@nestjs/swagger';
import { User } from '../../users/domain/user';
import { JobTypes } from '../../job-types/domain/job-types';
import { Cities } from '../../cities/domain/cities';
import { MerchandiserLanguages } from '../../merchandiser-languages/domain/merchandiser-languages';
import { MerchandiserSpecializations } from '../../merchandiser-specializations/domain/merchandiser-specializations';
import { MerchandiserReferences } from '../../merchandiser-references/domain/merchandiser-references';
import { MerchandiserEducation } from '../../merchandiser-education/domain/merchandiser-education';
import { MerchandiserFiles } from '../../merchandiser-files/domain/merchandiser-files';
import { Review } from '../../merchandiser-reviews/domain/merchandiser-reviews';
import { Contractuals } from '../../contractuals/domain/contractuals';
import { Status } from '../../merchandiser-statuses/domain/status';

export class Merchandiser {
  @ApiProperty({
    type: Number,
  })
  id: number;

  @ApiProperty({
    type: () => User,
  })
  user: User;

  @ApiProperty({
    type: Date,
    nullable: true,
  })
  birthday?: Date | null;

  @ApiProperty({
    type: String,
    nullable: true,
  })
  website?: string | null;

  @ApiProperty({
    type: String,
  })
  street: string;

  @ApiProperty({
    type: String,
  })
  zipCode: string;

  @ApiProperty({
    type: String,
    nullable: true,
  })
  tax_id?: string | null;

  @ApiProperty({
    type: String,
    nullable: true,
  })
  tax_no?: string | null;

  @ApiProperty({
    type: () => Cities,
  })
  city: Cities;

  @ApiProperty({
    type: String,
    nullable: true,
  })
  nationality?: string | null;

  @ApiProperty({
    type: String,
    nullable: true,
  })
  deliveryStreet?: string | null;

  @ApiProperty({
    type: String,
    nullable: true,
  })
  deliveryZipCode?: string | null;

  @ApiProperty({
    type: String,
    nullable: true,
  })
  deliveryCountry?: string | null;

  @ApiProperty({
    type: String,
    nullable: true,
  })
  secondaryResidence?: string | null;

  @ApiProperty({
    type: String,
    nullable: true,
  })
  secondaryZipCode?: string | null;

  @ApiProperty({
    type: String,
    nullable: true,
  })
  secondaryCountry?: string | null;

  @ApiProperty({
    type: () => [JobTypes],
  })
  jobTypes?: JobTypes[];
  
  @ApiProperty({
    type: () => Status,
  })
  status?: Status;

  @ApiProperty({
    type: () => [Contractuals],
  })
  contractuals?: Contractuals[];

  @ApiProperty({
    type: Boolean,
    description: 'Whether this merchandiser is favorited by the current user',
  })
  isFavorite?: boolean;

  // Relationships (optional, only loaded when requested)
  @ApiProperty({
    type: () => [MerchandiserLanguages],
    nullable: true,
  })
  languages?: MerchandiserLanguages[];

  @ApiProperty({
    type: () => [MerchandiserSpecializations],
    nullable: true,
  })
  specializations?: MerchandiserSpecializations[];

  @ApiProperty({
    type: () => [MerchandiserReferences],
    nullable: true,
  })
  references?: MerchandiserReferences[];

  @ApiProperty({
    type: () => [MerchandiserEducation],
    nullable: true,
  })
  education?: MerchandiserEducation[];

  @ApiProperty({
    type: () => [MerchandiserFiles],
    nullable: true,
  })
  files?: MerchandiserFiles[];

  @ApiProperty({
    type: 'array',
    items: {
      type: 'object',
      properties: {
        id: { type: 'number' },
        name: { type: 'string' },
        status: { type: 'string' },
        clientCompany: { 
          type: 'object',
          properties: {
            id: { type: 'number' },
            name: { type: 'string' }
          }
        },
        createdAt: { type: 'string' },
        updatedAt: { type: 'string' }
      }
    },
    description: 'Past and current client projects for this merchandiser',
  })
  projects?: {
    past: any[];
    current: any[];
  };

  @ApiProperty({
    type: () => [Review],
    nullable: true,
  })
  reviews?: Review[];

  @ApiProperty({
    type: 'object',
    nullable: true,
    properties: {
      averageRating: { type: 'number' },
      reviewCount: { type: 'number' },
    },
  })
  reviewStats?: {
    averageRating: number;
    reviewCount: number;
  };

  @ApiProperty({
    type: Date,
  })
  createdAt: Date;

  @ApiProperty({
    type: Date,
  })
  updatedAt: Date;
}