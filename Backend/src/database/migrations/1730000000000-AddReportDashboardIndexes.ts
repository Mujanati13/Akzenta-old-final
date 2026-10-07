import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddReportDashboardIndexes1730000000000 implements MigrationInterface {
  name = 'AddReportDashboardIndexes1730000000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // Add index on merchandiser_id for faster filtering by merchandiser
    // This index helps with the dashboard query that filters reports by merchandiser
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS "IDX_report_merchandiser_id" ON "report" ("merchandiser_id")`,
    );

    // Add index on status_id for faster filtering by status
    // This index helps with filtering reports by status (NEW, ASSIGNED, DUE)
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS "IDX_report_status_id" ON "report" ("status_id")`,
    );

    // Add composite index on (merchandiser_id, status_id) for optimal dashboard query performance
    // This composite index is specifically optimized for the dashboard query that filters
    // by both merchandiser_id and status_id (status IN (1, 2, 6))
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS "IDX_report_merchandiser_status" ON "report" ("merchandiser_id", "status_id")`,
    );

    // Add index on planned_on for faster date filtering (used for upcoming projects)
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS "IDX_report_planned_on" ON "report" ("planned_on")`,
    );

    // Add index on created_at for faster sorting (used for new requests sorting)
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS "IDX_report_created_at" ON "report" ("created_at")`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // Drop indexes in reverse order
    await queryRunner.query(`DROP INDEX IF EXISTS "IDX_report_created_at"`);
    await queryRunner.query(`DROP INDEX IF EXISTS "IDX_report_planned_on"`);
    await queryRunner.query(`DROP INDEX IF EXISTS "IDX_report_merchandiser_status"`);
    await queryRunner.query(`DROP INDEX IF EXISTS "IDX_report_status_id"`);
    await queryRunner.query(`DROP INDEX IF EXISTS "IDX_report_merchandiser_id"`);
  }
}

