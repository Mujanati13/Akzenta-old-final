import { Module, forwardRef } from '@nestjs/common';
import { MerchandiserFavoriteReportsService } from './merchandiser-favorite-reports.service';
import { MerchandiserFavoriteReportsController } from './merchandiser-favorite-reports.controller';
import { RelationalMerchandiserFavoriteReportPersistenceModule } from './infrastructure/persistence/relational/relational-persistence.module';
import { ReportModule } from '../report/report.module';
import { MerchandiserModule } from '../merchandiser/merchandiser.module';

@Module({
  imports: [
    RelationalMerchandiserFavoriteReportPersistenceModule,
    forwardRef(() => ReportModule),
    forwardRef(() => MerchandiserModule),
  ],
  controllers: [MerchandiserFavoriteReportsController],
  providers: [MerchandiserFavoriteReportsService],
  exports: [MerchandiserFavoriteReportsService, RelationalMerchandiserFavoriteReportPersistenceModule],
})
export class MerchandiserFavoriteReportsModule {}