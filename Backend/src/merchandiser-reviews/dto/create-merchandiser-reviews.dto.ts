import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsNumber, IsString, Max, Min } from 'class-validator';

export class CreateReviewDto {

  @ApiProperty({
    type: Number,
    description: 'Merchandiser ID',
  })
  @IsNumber()
  @IsNotEmpty()
  merchandiserId: number;

  @ApiProperty({
    type: Number,
    minimum: 1,
    maximum: 5,
    description: 'Rating from 1 to 5 stars',
    example: 4,
  })
  @IsNumber()
  @Min(1)
  @Max(5)
  @IsNotEmpty()
  rating: number;

  @ApiProperty({
    type: String,
    description: 'Review text',
    example: 'Great merchandiser, very professional and delivered excellent results.',
  })
  @IsString()
  @IsNotEmpty()
  review: string;
}