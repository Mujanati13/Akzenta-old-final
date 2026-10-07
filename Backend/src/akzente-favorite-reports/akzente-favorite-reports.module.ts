import {
  // do not remove this comment
  Module,
  forwardRef,
} from '@nestjs/common';
import { AkzenteFavoriteReportsService } from './akzente-favorite-reports.service';
import { AkzenteFavoriteReportsController } from './akzente-favorite-reports.controller';
import { RelationalAkzenteFavoriteReportPersistenceModule } from './infrastructure/persistence/relational/relational-persistence.module';
import { AkzenteModule } from '../akzente/akzente.module';
import { ReportModule } from '../report/report.module';

@Module({
  imports: [
    // do not remove this comment
    RelationalAkzenteFavoriteReportPersistenceModule,
    forwardRef(() => AkzenteModule),
    forwardRef(() => ReportModule),
  ],
  controllers: [AkzenteFavoriteReportsController],
  providers: [AkzenteFavoriteReportsService],
  exports: [
    AkzenteFavoriteReportsService,
    RelationalAkzenteFavoriteReportPersistenceModule,
  ],
})
export class AkzenteFavoriteReportsModule {}
