import { Injectable, NotFoundException, BadRequestException, Inject, forwardRef } from '@nestjs/common';
import { CreateReviewDto } from './dto/create-merchandiser-reviews.dto';
import { UpdateReviewDto } from './dto/update-merchandiser-reviews.dto';
import { ReviewRepository } from './infrastructure/persistence/merchandiser-reviews.repository';
import { IPaginationOptions } from '../utils/types/pagination-options';
import { Review } from './domain/merchandiser-reviews';
import { FilterReviewDto, SortReviewDto } from './dto/query-merchandiser-reviews.dto';
import { AkzenteService } from '../akzente/akzente.service';
import { MerchandiserService } from '../merchandiser/merchandiser.service';
import { JwtPayloadType } from '../auth/strategies/types/jwt-payload.type';
import { UsersService } from '../users/users.service';

@Injectable()
export class ReviewService {
  constructor(
    private readonly reviewRepository: ReviewRepository,
    @Inject(forwardRef(() => AkzenteService))
    private readonly akzenteService: AkzenteService,
    @Inject(forwardRef(() => MerchandiserService))
    private readonly merchandiserService: MerchandiserService,
    @Inject(forwardRef(() => UsersService))
    private readonly usersService: UsersService,
  ) {}

  async create(createReviewDto: CreateReviewDto, userJwtPayload: JwtPayloadType){
    // Check if akzente exists
    const akzenteUser = await this.usersService.findById(Number(userJwtPayload.id));
    if (!akzenteUser) {
      throw new NotFoundException('Akzente user not found');
    }
    const akzente = await this.akzenteService.findByUserId(akzenteUser.id);
    if (!akzente) {
      throw new NotFoundException('Akzente not found');
    }

    // Check if merchandiser exists
    const merchandiser = await this.merchandiserService.findById(createReviewDto.merchandiserId);
    if (!merchandiser) {
      throw new NotFoundException('Merchandiser not found');
    }

    // Prevent self-review (if akzente user is the same as merchandiser user)
    if (akzente.user.id === merchandiser.user.id) {
      throw new BadRequestException('Cannot review yourself');
    }

    const existingReview = await this.reviewRepository.findByAkzenteAndMerchandiser(
      akzente.id,
      createReviewDto.merchandiserId,
    );

    if (existingReview) {
      await this.reviewRepository.update(existingReview.id, {
        rating: createReviewDto.rating,
        review: createReviewDto.review,
      });
    } else {
      await this.reviewRepository.create({
        akzente,
        merchandiser,
        rating: createReviewDto.rating,
        review: createReviewDto.review,
      });
    }

    return await this.getMerchandiserStats(merchandiser.id);
  }

  findAllWithPagination({
    paginationOptions,
    filters,
    sort,
  }: {
    paginationOptions: IPaginationOptions;
    filters?: FilterReviewDto | null;
    sort?: SortReviewDto[] | null;
  }) {
    return this.reviewRepository.findAllWithPagination({
      paginationOptions: {
        page: paginationOptions.page,
        limit: paginationOptions.limit,
      },
      filters,
      sort,
    });
  }

  findById(id: Review['id']) {
    return this.reviewRepository.findById(id);
  }

  findByMerchandiserId(merchandiserId: number) {
    return this.reviewRepository.findByMerchandiserId(merchandiserId);
  }

  findByAkzenteId(akzenteId: number) {
    return this.reviewRepository.findByAkzenteId(akzenteId);
  }

  async findByAkzenteAndMerchandiser(akzenteId: number, merchandiserId: number) {
    return this.reviewRepository.findByAkzenteAndMerchandiser(akzenteId, merchandiserId);
  }

  async update(id: Review['id'], updateReviewDto: UpdateReviewDto) {
    const review = await this.reviewRepository.findById(id);
    if (!review) {
      throw new NotFoundException('Review not found');
    }

    return this.reviewRepository.update(id, updateReviewDto);
  }

  async remove(id: Review['id']) {
    const review = await this.reviewRepository.findById(id);
    if (!review) {
      throw new NotFoundException('Review not found');
    }

    return this.reviewRepository.remove(id);
  }

  async getMerchandiserStats(merchandiserId: number) {
    const [averageRating, reviewCount, reviews] = await Promise.all([
      this.reviewRepository.getAverageRating(merchandiserId),
      this.reviewRepository.getReviewCount(merchandiserId),
      this.reviewRepository.findByMerchandiserId(merchandiserId),
    ]);

    return {
      averageRating: Math.round(averageRating * 10) / 10, // Round to 1 decimal place
      reviewCount,
      reviews,
    };
  }
}