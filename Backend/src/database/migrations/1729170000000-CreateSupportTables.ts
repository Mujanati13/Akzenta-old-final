import { MigrationInterface, QueryRunner } from 'typeorm';

export class CreateSupportTables1729170000000 implements MigrationInterface {
  name = 'CreateSupportTables1729170000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // Create support table
    await queryRunner.query(
      `CREATE TABLE "support" (
        "id" SERIAL NOT NULL,
        "email" character varying NOT NULL,
        "createdAt" TIMESTAMP NOT NULL DEFAULT now(),
        "updatedAt" TIMESTAMP NOT NULL DEFAULT now(),
        CONSTRAINT "UQ_support_email" UNIQUE ("email"),
        CONSTRAINT "PK_support" PRIMARY KEY ("id")
      )`,
    );

    // Create support_mails table
    await queryRunner.query(
      `CREATE TABLE "support_mails" (
        "id" SERIAL NOT NULL,
        "client_id" integer NOT NULL,
        "subject" character varying NOT NULL,
        "content" text NOT NULL,
        "createdAt" TIMESTAMP NOT NULL DEFAULT now(),
        "updatedAt" TIMESTAMP NOT NULL DEFAULT now(),
        CONSTRAINT "PK_support_mails" PRIMARY KEY ("id")
      )`,
    );

    // Add foreign key constraint
    await queryRunner.query(
      `ALTER TABLE "support_mails"
       ADD CONSTRAINT "FK_support_mails_client"
       FOREIGN KEY ("client_id")
       REFERENCES "client"("id")
       ON DELETE CASCADE
       ON UPDATE NO ACTION`,
    );

    // Create index on client_id for faster lookups
    await queryRunner.query(
      `CREATE INDEX "IDX_support_mails_client_id" ON "support_mails" ("client_id")`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // Drop index
    await queryRunner.query(`DROP INDEX "IDX_support_mails_client_id"`);

    // Drop foreign key constraint
    await queryRunner.query(
      `ALTER TABLE "support_mails" DROP CONSTRAINT "FK_support_mails_client"`,
    );

    // Drop tables
    await queryRunner.query(`DROP TABLE "support_mails"`);
    await queryRunner.query(`DROP TABLE "support"`);
  }
}

