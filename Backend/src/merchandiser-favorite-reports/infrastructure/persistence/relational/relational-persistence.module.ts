import { Module } from '@nestjs/common';
import { MerchandiserFavoriteReportRepository } from '../merchandiser-favorite-report.repository';
import { MerchandiserFavoriteReportRelationalRepository } from './repositories/merchandiser-favorite-report.repository';
import { TypeOrmModule } from '@nestjs/typeorm';
import { MerchandiserFavoriteReportEntity } from './entities/merchandiser-favorite-report.entity';

@Module({
  imports: [TypeOrmModule.forFeature([MerchandiserFavoriteReportEntity])],
  providers: [
    {
      provide: MerchandiserFavoriteReportRepository,
      useClass: MerchandiserFavoriteReportRelationalRepository,
    },
  ],
  exports: [MerchandiserFavoriteReportRepository],
})
export class RelationalMerchandiserFavoriteReportPersistenceModule {}