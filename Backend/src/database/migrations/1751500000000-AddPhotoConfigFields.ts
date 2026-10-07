import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddPhotoConfigFields1751500000000 implements MigrationInterface {
  name = 'AddPhotoConfigFields1751500000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "project" ADD "photo_image_name_pattern" text`,
    );
    await queryRunner.query(
      `ALTER TABLE "advanced_photo" ADD "before_image_count" integer`,
    );
    await queryRunner.query(
      `ALTER TABLE "advanced_photo" ADD "after_image_count" integer`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "advanced_photo" DROP COLUMN "after_image_count"`,
    );
    await queryRunner.query(
      `ALTER TABLE "advanced_photo" DROP COLUMN "before_image_count"`,
    );
    await queryRunner.query(
      `ALTER TABLE "project" DROP COLUMN "photo_image_name_pattern"`,
    );
  }
}
