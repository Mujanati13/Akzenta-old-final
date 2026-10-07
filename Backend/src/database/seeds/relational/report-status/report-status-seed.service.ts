import { Injectable, Logger } from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import { DataSource, EntityManager } from 'typeorm';

const NEW_STATUSES = [
  {
    id: 1,
    name: 'pending',
    akzenteName: 'Pending',
    clientName: 'Pending',
    merchandiserName: 'Pending',
    akzenteColor: '#9E9E9E',
    clientColor: '#9E9E9E',
    merchandiserColor: '#9E9E9E',
  },
  {
    id: 2,
    name: 'scheduled',
    akzenteName: 'Scheduled',
    clientName: 'Scheduled',
    merchandiserName: 'Scheduled',
    akzenteColor: '#00709B',
    clientColor: '#00709B',
    merchandiserColor: '#00709B',
  },
  {
    id: 3,
    name: 'submitted',
    akzenteName: 'Review',
    clientName: 'Scheduled',
    merchandiserName: 'Submitted',
    akzenteColor: '#FF8C00',
    clientColor: '#00709B',
    merchandiserColor: '#CCAF08',
  },
  {
    id: 4,
    name: 'approved',
    akzenteName: 'Done',
    clientName: 'Available',
    merchandiserName: 'Done',
    akzenteColor: '#6FCC08',
    clientColor: '#08C6CC',
    merchandiserColor: '#6FCC08',
  },
  {
    id: 5,
    name: 'viewed',
    akzenteName: 'Done',
    clientName: 'Done',
    merchandiserName: 'Done',
    akzenteColor: '#6FCC08',
    clientColor: '#6FCC08',
    merchandiserColor: '#6FCC08',
  },
];

@Injectable()
export class ReportStatusSeedService {
  private readonly logger = new Logger(ReportStatusSeedService.name);

  constructor(
    @InjectDataSource()
    private readonly dataSource: DataSource,
  ) {}

  async run(): Promise<void> {
    this.logger.log('🔄 Starting report-status seed update...');

    // Verify connection and table visibility before starting
    try {
      const check = await this.dataSource.query(
        `SELECT id, name FROM public."report-status" ORDER BY id`,
      );
      this.logger.log(`🔍 Current report-status rows: ${JSON.stringify(check)}`);
    } catch (err) {
      this.logger.error('❌ Cannot read public."report-status" — check DB connection/schema', err);
      throw err;
    }

    await this.dataSource.transaction(async (em: EntityManager) => {
      // Detect old rows
      const oldRows: { id: number }[] = await em.query(
        `SELECT id FROM public."report-status" WHERE id IN (6, 7, 8, 9)`,
      );
      this.logger.log(`🔍 Old rows found: ${JSON.stringify(oldRows)}`);
      const hasOldStatuses = oldRows.length > 0;

      if (hasOldStatuses) {
        this.logger.log(`📊 Migrating ${oldRows.length} old status(es) in report table...`);
        await this.migrateReportStatusIds(em);
        this.logger.log('✅ Report status_id migration complete');
      } else {
        this.logger.log('ℹ️  No old statuses — skipping report migration');
      }

      // Update rows 1–5
      this.logger.log('📝 Updating report-status rows 1–5...');
      for (const s of NEW_STATUSES) {
        const res = await em.query(
          `UPDATE public."report-status"
           SET name                = $1,
               "akzenteName"       = $2,
               "clientName"        = $3,
               "merchandiserName"  = $4,
               "akzenteColor"      = $5,
               "clientColor"       = $6,
               "merchandiserColor" = $7
           WHERE id = $8`,
          [s.name, s.akzenteName, s.clientName, s.merchandiserName,
           s.akzenteColor, s.clientColor, s.merchandiserColor, s.id],
        );
        this.logger.log(`  ↳ id=${s.id} → ${s.name} (affected: ${res[1] ?? res?.rowCount ?? '?'})`);
      }

      // Delete old rows 6–9
      if (hasOldStatuses) {
        this.logger.log('🗑️  Deleting rows 6–9...');
        await em.query(`DELETE FROM public."report-status" WHERE id IN (6, 7, 8, 9)`);
      }
    });

    // Verify final state
    const final = await this.dataSource.query(
      `SELECT id, name, "akzenteName", "clientName", "merchandiserName" FROM public."report-status" ORDER BY id`,
    );
    this.logger.log(`✅ Final report-status rows: ${JSON.stringify(final)}`);
  }

  /**
   * Migrate existing report.status_id values from the old 9-status system
   * to the new 5-status system. Applied in safe order to avoid ID collisions.
   *
   *   9 (valid)            → 5 (viewed)
   *   8 (opened_by_client) → 4 (approved)
   *   3,4,5,6              → 2 (scheduled)   ← before 7→3 to avoid collision
   *   7 (finished)         → 3 (submitted)
   *   2 (assigned) without VM or date → 1 (pending)
   *   1 (new)              → stays 1 (pending)
   */
  private async migrateReportStatusIds(em: EntityManager): Promise<void> {
    let res: any;

    res = await em.query(`UPDATE public.report SET status_id = 5 WHERE status_id = 9`);
    this.logger.log(`  ↳ valid(9)→viewed(5)  rows: ${res[1] ?? res?.rowCount ?? 0}`);

    res = await em.query(`UPDATE public.report SET status_id = 4 WHERE status_id = 8`);
    this.logger.log(`  ↳ opened_by_client(8)→approved(4)  rows: ${res[1] ?? res?.rowCount ?? 0}`);

    res = await em.query(`UPDATE public.report SET status_id = 2 WHERE status_id IN (3, 4, 5, 6)`);
    this.logger.log(`  ↳ accepted/draft/in_progress/due(3-6)→scheduled(2)  rows: ${res[1] ?? res?.rowCount ?? 0}`);

    res = await em.query(`UPDATE public.report SET status_id = 3 WHERE status_id = 7`);
    this.logger.log(`  ↳ finished(7)→submitted(3)  rows: ${res[1] ?? res?.rowCount ?? 0}`);

    res = await em.query(
      `UPDATE public.report
       SET status_id = 1
       WHERE status_id = 2
         AND (merchandiser_id IS NULL OR (visit_date IS NULL AND planned_on IS NULL))`,
    );
    this.logger.log(`  ↳ assigned(2) without VM/date→pending(1)  rows: ${res[1] ?? res?.rowCount ?? 0}`);
  }
}
