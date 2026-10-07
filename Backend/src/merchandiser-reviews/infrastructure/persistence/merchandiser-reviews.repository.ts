import { DeepPartial } from '../../../utils/types/deep-partial.type';
import { NullableType } from '../../../utils/types/nullable.type';
import { IPaginationOptions } from '../../../utils/types/pagination-options';
import { Review } from '../../domain/merchandiser-reviews';
import { FilterReviewDto, SortReviewDto } from '../../dto/query-merchandiser-reviews.dto';

export abstract class ReviewRepository {
  abstract create(
    data: Omit<Review, 'id' | 'createdAt' | 'updatedAt'>,
  ): Promise<Review>;

  abstract findAllWithPagination({
    paginationOptions,
    filters,
    sort,
  }: {
    paginationOptions: IPaginationOptions;
    filters?: FilterReviewDto | null;
    sort?: SortReviewDto[] | null;
  }): Promise<{ data: Review[]; totalCount: number }>;

  abstract findById(id: Review['id']): Promise<NullableType<Review>>;

  abstract findByAkzenteAndMerchandiser(
    akzenteId: number,
    merchandiserId: number,
  ): Promise<NullableType<Review>>;

  abstract findByMerchandiserId(merchandiserId: number): Promise<Review[]>;

  abstract findByAkzenteId(akzenteId: number): Promise<Review[]>;

  abstract update(
    id: Review['id'],
    payload: DeepPartial<Review>,
  ): Promise<Review | null>;

  abstract remove(id: Review['id']): Promise<void>;

  abstract getAverageRating(merchandiserId: number): Promise<number>;

  abstract getReviewCount(merchandiserId: number): Promise<number>;
}