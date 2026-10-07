import { Module } from '@nestjs/common';
import { ReportStatusSeedService } from './report-status-seed.service';

@Module({
  providers: [ReportStatusSeedService],
  exports: [ReportStatusSeedService],
})
export class ReportStatusSeedModule {}
