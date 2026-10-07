import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class ReportStatus {
  @ApiProperty({
    type: Number,
  })
  id: number;

  @ApiProperty({
    type: String,
  })
  name: string;

  @ApiProperty({
    type: String,
  })
  akzenteName?: string | null;

  @ApiProperty({
    type: String,
  })
  clientName?: string | null;

  @ApiProperty({
    type: String,
  })
  merchandiserName?: string | null;

  @ApiProperty({
    type: String,
  })
  akzenteColor?: string | null;

  @ApiProperty({
    type: String,
  })
  clientColor?: string | null;

  @ApiProperty({
    type: String,
  })
  merchandiserColor?: string | null;

  @ApiPropertyOptional({
    type: String,
    description: 'Resolved color for the current user type in API responses',
  })
  color?: string | null;
}
