import { Module } from '@nestjs/common';
import { ReviewRepository } from '../merchandiser-reviews.repository';
import { ReviewRelationalRepository } from './repositories/merchandiser-reviews.repository';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ReviewEntity } from './entities/merchandiser-reviews.entity';
import { AkzenteEntity } from '../../../../akzente/infrastructure/persistence/relational/entities/akzente.entity';
import { MerchandiserEntity } from '../../../../merchandiser/infrastructure/persistence/relational/entities/merchandiser.entity';

@Module({
  imports: [TypeOrmModule.forFeature([ReviewEntity, AkzenteEntity, MerchandiserEntity])],
  providers: [
    {
      provide: ReviewRepository,
      useClass: ReviewRelationalRepository,
    },
  ],
  exports: [ReviewRepository],
})
export class RelationalReviewPersistenceModule {}