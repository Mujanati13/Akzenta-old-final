import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddMerchandiserAlternateAddresses1747315200000
  implements MigrationInterface
{
  name = 'AddMerchandiserAlternateAddresses1747315200000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "merchandiser" ADD COLUMN "delivery_street" character varying`,
    );
    await queryRunner.query(
      `ALTER TABLE "merchandiser" ADD COLUMN "delivery_zip_code" character varying`,
    );
    await queryRunner.query(
      `ALTER TABLE "merchandiser" ADD COLUMN "delivery_country" character varying`,
    );
    await queryRunner.query(
      `ALTER TABLE "merchandiser" ADD COLUMN "secondary_residence" character varying`,
    );
    await queryRunner.query(
      `ALTER TABLE "merchandiser" ADD COLUMN "secondary_zip_code" character varying`,
    );
    await queryRunner.query(
      `ALTER TABLE "merchandiser" ADD COLUMN "secondary_country" character varying`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "merchandiser" DROP COLUMN "secondary_country"`,
    );
    await queryRunner.query(
      `ALTER TABLE "merchandiser" DROP COLUMN "secondary_zip_code"`,
    );
    await queryRunner.query(
      `ALTER TABLE "merchandiser" DROP COLUMN "secondary_residence"`,
    );
    await queryRunner.query(
      `ALTER TABLE "merchandiser" DROP COLUMN "delivery_country"`,
    );
    await queryRunner.query(
      `ALTER TABLE "merchandiser" DROP COLUMN "delivery_zip_code"`,
    );
    await queryRunner.query(
      `ALTER TABLE "merchandiser" DROP COLUMN "delivery_street"`,
    );
  }
}
