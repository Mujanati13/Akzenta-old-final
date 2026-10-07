import { MigrationInterface, QueryRunner } from 'typeorm';

export class MoveIsSalesToClient1734444800000 implements MigrationInterface {
  name = 'MoveIsSalesToClient1734444800000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // Add isSales column to client table
    await queryRunner.query(
      `ALTER TABLE "client" ADD COLUMN "isSales" boolean NOT NULL DEFAULT false`,
    );

    // Remove isSales column from akzente table
    await queryRunner.query(
      `ALTER TABLE "akzente" DROP COLUMN "isSales"`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // Add isSales column back to akzente table
    await queryRunner.query(
      `ALTER TABLE "akzente" ADD COLUMN "isSales" boolean NOT NULL DEFAULT false`,
    );

    // Remove isSales column from client table
    await queryRunner.query(
      `ALTER TABLE "client" DROP COLUMN "isSales"`,
    );
  }
}
