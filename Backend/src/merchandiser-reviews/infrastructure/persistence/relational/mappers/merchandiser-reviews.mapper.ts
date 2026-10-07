import { AkzenteMapper } from '../../../../../akzente/infrastructure/persistence/relational/mappers/akzente.mapper';
import { MerchandiserMapper } from '../../../../../merchandiser/infrastructure/persistence/relational/mappers/merchandiser.mapper';
import { Review } from '../../../../domain/merchandiser-reviews';
import { ReviewEntity } from '../entities/merchandiser-reviews.entity';

export class ReviewMapper {
  static toDomain(raw: ReviewEntity): Review {
    const domainEntity = new Review();
    domainEntity.id = raw.id;
    if (raw.akzente) {
      domainEntity.akzente = AkzenteMapper.toDomain(raw.akzente);
    }
    domainEntity.rating = raw.rating;
    domainEntity.review = raw.review;
    domainEntity.createdAt = raw.createdAt;
    domainEntity.updatedAt = raw.updatedAt;
    return domainEntity;
  }

  static toPersistence(domainEntity: Review): ReviewEntity {
    const persistenceEntity = new ReviewEntity();
    if (domainEntity.id) {
      persistenceEntity.id = domainEntity.id;
    }
    if (domainEntity.akzente) {
      persistenceEntity.akzente = AkzenteMapper.toPersistence(domainEntity.akzente);
    }
    if (domainEntity.merchandiser) {
      persistenceEntity.merchandiser = MerchandiserMapper.toPersistence(domainEntity.merchandiser);
    }
    persistenceEntity.rating = domainEntity.rating;
    persistenceEntity.review = domainEntity.review;
    persistenceEntity.createdAt = domainEntity.createdAt;
    persistenceEntity.updatedAt = domainEntity.updatedAt;
    return persistenceEntity;
  }
}