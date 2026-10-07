import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddSessionLastActivityAt1747401600000 implements MigrationInterface {
  name = 'AddSessionLastActivityAt1747401600000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "session" ADD "lastActivityAt" TIMESTAMP NOT NULL DEFAULT now()`,
    );
    await queryRunner.query(
      `UPDATE "session" SET "lastActivityAt" = COALESCE("updatedAt", "createdAt")`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "session" DROP COLUMN "lastActivityAt"`,
    );
  }
}
