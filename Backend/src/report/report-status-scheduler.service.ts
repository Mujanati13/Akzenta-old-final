import { Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ReportEntity } from './infrastructure/persistence/relational/entities/report.entity';
import { ReportService } from './report.service';

@Injectable()
export class ReportStatusSchedulerService {
  private readonly logger = new Logger(ReportStatusSchedulerService.name);

  constructor(
    @InjectRepository(ReportEntity)
    private readonly reportRepository: Repository<ReportEntity>,
    private readonly reportService: ReportService,
  ) {}

  /**
   * Legacy cron hook retained for compatibility.
   * The 5-status workflow no longer auto-transitions reports by visit date.
   */
  @Cron('0 1 * * *', {
    name: 'update-report-statuses',
    timeZone: 'Europe/Berlin',
  })
  async updateReportStatuses(): Promise<void> {
    this.logger.log(
      'ℹ️ Daily report status cron skipped — statuses are event-driven in the 5-status workflow',
    );
  }

  async triggerStatusUpdate(): Promise<{ message: string; updatedCount: number }> {
    return {
      message:
        'Automatic visit-date status transitions are disabled in the 5-status workflow.',
      updatedCount: 0,
    };
  }
}
