import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, SelectQueryBuilder } from 'typeorm';
import { ReviewEntity } from '../entities/merchandiser-reviews.entity';
import { NullableType } from '../../../../../utils/types/nullable.type';
import { Review } from '../../../../domain/merchandiser-reviews';
import { ReviewRepository } from '../../merchandiser-reviews.repository';
import { ReviewMapper } from '../mappers/merchandiser-reviews.mapper';
import { IPaginationOptions } from '../../../../../utils/types/pagination-options';
import { FilterReviewDto, SortReviewDto } from '../../../../dto/query-merchandiser-reviews.dto';
import { AkzenteEntity } from '../../../../../akzente/infrastructure/persistence/relational/entities/akzente.entity';
import { MerchandiserEntity } from '../../../../../merchandiser/infrastructure/persistence/relational/entities/merchandiser.entity';

@Injectable()
export class ReviewRelationalRepository implements ReviewRepository {
  constructor(
    @InjectRepository(ReviewEntity)
    private readonly reviewRepository: Repository<ReviewEntity>,
    @InjectRepository(AkzenteEntity)
    private readonly akzenteRepository: Repository<AkzenteEntity>,
    @InjectRepository(MerchandiserEntity)
    private readonly merchandiserRepository: Repository<MerchandiserEntity>,
  ) {}

  async create(data: Review): Promise<Review> {
    const persistenceModel = ReviewMapper.toPersistence(data);
    const newEntity = await this.reviewRepository.save(
      this.reviewRepository.create(persistenceModel),
    );
    return ReviewMapper.toDomain(newEntity);
  }

  async findAllWithPagination({
    paginationOptions,
    filters,
    sort,
  }: {
    paginationOptions: IPaginationOptions;
    filters?: FilterReviewDto | null;
    sort?: SortReviewDto[] | null;
  }): Promise<{ data: Review[]; totalCount: number }> {
    const queryBuilder = this.reviewRepository
      .createQueryBuilder('review')
      .leftJoinAndSelect('review.akzente', 'akzente')
      .leftJoinAndSelect('akzente.user', 'akzenteUser')
      .leftJoinAndSelect('review.merchandiser', 'merchandiser')
      .leftJoinAndSelect('merchandiser.user', 'merchandiserUser');

    this.applyFilters(queryBuilder, filters);
    this.applySorting(queryBuilder, sort);

    const totalCount = await queryBuilder.getCount();

    const entities = await queryBuilder
      .skip((paginationOptions.page - 1) * paginationOptions.limit)
      .take(paginationOptions.limit)
      .getMany();

    return {
      data: entities.map((entity) => ReviewMapper.toDomain(entity)),
      totalCount,
    };
  }

  async findById(id: Review['id']): Promise<NullableType<Review>> {
    const entity = await this.reviewRepository.findOne({
      where: { id },
      relations: [
        'akzente',
        'akzente.user',
        'merchandiser',
        'merchandiser.user',
      ],
    });

    return entity ? ReviewMapper.toDomain(entity) : null;
  }

  async findByAkzenteAndMerchandiser(
    akzenteId: number,
    merchandiserId: number,
  ): Promise<NullableType<Review>> {
    const entity = await this.reviewRepository.findOne({
      where: {
        akzente: { id: akzenteId },
        merchandiser: { id: merchandiserId },
      },
      relations: [
        'akzente',
        'akzente.user',
        'merchandiser',
        'merchandiser.user',
      ],
    });

    return entity ? ReviewMapper.toDomain(entity) : null;
  }

  async findByMerchandiserId(merchandiserId: number): Promise<Review[]> {
    const entities = await this.reviewRepository.find({
      where: { merchandiser: { id: merchandiserId } },
      relations: [
        'akzente',
        'akzente.user',
        'merchandiser',
        'merchandiser.user',
      ],
      order: { createdAt: 'DESC' },
    });

    return entities.map((entity) => ReviewMapper.toDomain(entity));
  }

  async findByAkzenteId(akzenteId: number): Promise<Review[]> {
    const entities = await this.reviewRepository.find({
      where: { akzente: { id: akzenteId } },
      relations: [
        'akzente',
        'akzente.user',
        'merchandiser',
        'merchandiser.user',
      ],
      order: { createdAt: 'DESC' },
    });

    return entities.map((entity) => ReviewMapper.toDomain(entity));
  }

  async update(id: Review['id'], payload: Partial<Review>): Promise<Review | null> {
    const entity = await this.reviewRepository.findOne({
      where: { id },
      relations: ['akzente', 'merchandiser'],
    });

    if (!entity) {
      return null;
    }

    // Update only the fields that can be updated
    if (payload.rating !== undefined) {
      entity.rating = payload.rating;
    }
    if (payload.review !== undefined) {
      entity.review = payload.review;
    }

    const updatedEntity = await this.reviewRepository.save(entity);

    return ReviewMapper.toDomain(updatedEntity);
  }

  async remove(id: Review['id']): Promise<void> {
    await this.reviewRepository.delete(id);
  }

  async getAverageRating(merchandiserId: number): Promise<number> {
    const result = await this.reviewRepository
      .createQueryBuilder('review')
      .select('AVG(review.rating)', 'average')
      .where('review.merchandiser.id = :merchandiserId', { merchandiserId })
      .getRawOne();

    return parseFloat(result?.average) || 0;
  }

  async getReviewCount(merchandiserId: number): Promise<number> {
    return await this.reviewRepository.count({
      where: { merchandiser: { id: merchandiserId } },
    });
  }

  private applyFilters(
    queryBuilder: SelectQueryBuilder<ReviewEntity>,
    filters?: FilterReviewDto | null,
  ): void {
    if (!filters) return;

    if (filters.akzenteId) {
      queryBuilder.andWhere('review.akzente.id = :akzenteId', {
        akzenteId: filters.akzenteId,
      });
    }

    if (filters.merchandiserId) {
      queryBuilder.andWhere('review.merchandiser.id = :merchandiserId', {
        merchandiserId: filters.merchandiserId,
      });
    }

    if (filters.minRating) {
      queryBuilder.andWhere('review.rating >= :minRating', {
        minRating: filters.minRating,
      });
    }

    if (filters.maxRating) {
      queryBuilder.andWhere('review.rating <= :maxRating', {
        maxRating: filters.maxRating,
      });
    }
  }

  private applySorting(
    queryBuilder: SelectQueryBuilder<ReviewEntity>,
    sort?: SortReviewDto[] | null,
  ): void {
    if (!sort || sort.length === 0) {
      queryBuilder.orderBy('review.createdAt', 'DESC');
      return;
    }

    sort.forEach((sortOption, index) => {
      if (sortOption.orderBy) {
        const field = this.mapSortField(sortOption.orderBy);
        const direction = sortOption.order?.toUpperCase() as 'ASC' | 'DESC';

        if (index === 0) {
          queryBuilder.orderBy(field, direction || 'DESC');
        } else {
          queryBuilder.addOrderBy(field, direction || 'DESC');
        }
      }
    });
  }

  private mapSortField(field: string): string {
    const fieldMappings: { [key: string]: string } = {
      rating: 'review.rating',
      createdAt: 'review.createdAt',
      updatedAt: 'review.updatedAt',
    };

    return fieldMappings[field] || 'review.createdAt';
  }
}