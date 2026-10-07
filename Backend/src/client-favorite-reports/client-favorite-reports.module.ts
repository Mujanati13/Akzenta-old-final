import {
  // do not remove this comment
  Module,
  forwardRef,
} from '@nestjs/common';
import { ClientFavoriteReportsService } from './client-favorite-reports.service';
import { ClientFavoriteReportsController } from './client-favorite-reports.controller';
import { RelationalClientFavoriteReportPersistenceModule } from './infrastructure/persistence/relational/relational-persistence.module';
import { ClientModule } from '../client/client.module';
import { ReportModule } from '../report/report.module';

@Module({
  imports: [
    // do not remove this comment
    RelationalClientFavoriteReportPersistenceModule,
    forwardRef(() => ClientModule),
    forwardRef(() => ReportModule),
  ],
  controllers: [ClientFavoriteReportsController],
  providers: [ClientFavoriteReportsService],
  exports: [
    ClientFavoriteReportsService,
    RelationalClientFavoriteReportPersistenceModule,
  ],
})
export class ClientFavoriteReportsModule {}
