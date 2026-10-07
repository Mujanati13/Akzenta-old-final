import { Module } from '@nestjs/common';
import { AkzenteFavoriteMerchandiserRepository } from '../akzente-favorite-merchandiser.repository';
import { AkzenteFavoriteMerchandiserRelationalRepository } from './repositories/akzente-favorite-merchandiser.repository';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AkzenteFavoriteMerchandiserEntity } from './entities/akzente-favorite-merchandiser.entity';

@Module({
  imports: [TypeOrmModule.forFeature([AkzenteFavoriteMerchandiserEntity])],
  providers: [
    {
      provide: AkzenteFavoriteMerchandiserRepository,
      useClass: AkzenteFavoriteMerchandiserRelationalRepository,
    },
  ],
  exports: [AkzenteFavoriteMerchandiserRepository],
})
export class RelationalAkzenteFavoriteMerchandiserPersistenceModule {}
