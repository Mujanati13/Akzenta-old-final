import { Module, forwardRef } from '@nestjs/common';
import { AkzenteFavoriteMerchandisersService } from './akzente-favorite-merchandiser.service';
import { AkzenteFavoriteMerchandisersController } from './akzente-favorite-merchandiser.controller';
import { RelationalAkzenteFavoriteMerchandiserPersistenceModule } from './infrastructure/persistence/relational/relational-persistence.module';
import { AkzenteModule } from '../akzente/akzente.module';
import { MerchandiserModule } from '../merchandiser/merchandiser.module';

@Module({
  imports: [
    RelationalAkzenteFavoriteMerchandiserPersistenceModule,
    forwardRef(() => AkzenteModule),
    forwardRef(() => MerchandiserModule),
  ],
  controllers: [AkzenteFavoriteMerchandisersController],
  providers: [AkzenteFavoriteMerchandisersService],
  exports: [AkzenteFavoriteMerchandisersService, RelationalAkzenteFavoriteMerchandiserPersistenceModule],
})
export class AkzenteFavoriteMerchandisersModule {}