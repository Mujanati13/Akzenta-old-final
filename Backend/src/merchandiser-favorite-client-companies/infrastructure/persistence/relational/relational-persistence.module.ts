import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { MerchandiserFavoriteClientCompanyRepository } from '../merchandiser-favorite-client-company.repository';
import { MerchandiserFavoriteClientCompanyRelationalRepository } from './repositories/merchandiser-favorite-client-company.repository';
import { MerchandiserFavoriteClientCompanyEntity } from './entities/merchandiser-favorite-client-company.entity';

@Module({
  imports: [TypeOrmModule.forFeature([MerchandiserFavoriteClientCompanyEntity])],
  providers: [
    {
      provide: MerchandiserFavoriteClientCompanyRepository,
      useClass: MerchandiserFavoriteClientCompanyRelationalRepository,
    },
  ],
  exports: [MerchandiserFavoriteClientCompanyRepository],
})
export class RelationalMerchandiserFavoriteClientCompanyPersistenceModule {}
