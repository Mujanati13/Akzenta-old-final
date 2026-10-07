import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddReportAcceptedColumn1752000000000 implements MigrationInterface {
  name = 'AddReportAcceptedColumn1752000000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "report" ADD "accepted" boolean NOT NULL DEFAULT false`,
    );

    // Reports that progressed past assignment are treated as accepted.
    await queryRunner.query(`
      UPDATE "report"
      SET "accepted" = true
      WHERE "merchandiser_id" IS NOT NULL
        AND "status_id" IN (4, 5, 6, 7, 8, 9)
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "report" DROP COLUMN "accepted"`);
  }
}
