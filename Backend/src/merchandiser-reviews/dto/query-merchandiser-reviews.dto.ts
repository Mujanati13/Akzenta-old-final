import { ApiPropertyOptional } from '@nestjs/swagger';
import { Transform, Type } from 'class-transformer';
import { IsNumber, IsOptional, Max, Min } from 'class-validator';

export class FilterReviewDto {
  @ApiPropertyOptional({
    type: Number,
    description: 'Filter by Akzente ID',
  })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  akzenteId?: number;

  @ApiPropertyOptional({
    type: Number,
    description: 'Filter by Merchandiser ID',
  })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  merchandiserId?: number;

  @ApiPropertyOptional({
    type: Number,
    minimum: 1,
    maximum: 5,
    description: 'Filter by minimum rating',
  })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(1)
  @Max(5)
  minRating?: number;

  @ApiPropertyOptional({
    type: Number,
    minimum: 1,
    maximum: 5,
    description: 'Filter by maximum rating',
  })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(1)
  @Max(5)
  maxRating?: number;
}

export class SortReviewDto {
  @ApiPropertyOptional({ enum: ['rating', 'createdAt', 'updatedAt'] })
  @IsOptional()
  orderBy?: 'rating' | 'createdAt' | 'updatedAt';

  @ApiPropertyOptional({ enum: ['asc', 'desc'] })
  @IsOptional()
  order?: 'asc' | 'desc';
}

export class QueryReviewDto {
  @ApiPropertyOptional({
    type: Number,
    minimum: 1,
    default: 1,
  })
  @Type(() => Number)
  @IsOptional()
  @IsNumber()
  @Min(1)
  page?: number;

  @ApiPropertyOptional({
    type: Number,
    minimum: 1,
    maximum: 50,
    default: 10,
  })
  @Type(() => Number)
  @IsOptional()
  @IsNumber()
  @Min(1)
  @Max(50)
  limit?: number;

  @ApiPropertyOptional({
    type: String,
    description: 'Filters for reviews',
  })
  @IsOptional()
  @Transform(({ value }) => {
    return value ? JSON.parse(value) : undefined;
  })
  @Type(() => FilterReviewDto)
  filters?: FilterReviewDto | null;

  @ApiPropertyOptional({
    type: String,
    description: 'Sorting options for reviews',
  })
  @IsOptional()
  @Transform(({ value }) => {
    return value ? JSON.parse(value) : undefined;
  })
  @Type(() => SortReviewDto)
  sort?: SortReviewDto[] | null;
}