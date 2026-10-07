import { Module, forwardRef } from '@nestjs/common';
import { ReviewService } from './merchandiser-reviews.service';
import { ReviewController } from './merchandiser-reviews.controller';
import { RelationalReviewPersistenceModule } from './infrastructure/persistence/relational/relational-persistence.module';
import { AkzenteModule } from '../akzente/akzente.module';
import { MerchandiserModule } from '../merchandiser/merchandiser.module';
import { UsersModule } from '../users/users.module';

@Module({
  imports: [
    RelationalReviewPersistenceModule,
    forwardRef(() => AkzenteModule),
    forwardRef(() => MerchandiserModule),
    forwardRef(() => UsersModule)
  ],
  controllers: [ReviewController],
  providers: [ReviewService],
  exports: [ReviewService, RelationalReviewPersistenceModule],
})
export class ReviewModule {}