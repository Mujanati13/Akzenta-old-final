import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Resyncs every serial/identity id sequence to MAX(id) of its table.
 * Needed because rows inserted with explicit ids (dump restore / seeds)
 * do not advance the sequence, causing "duplicate key value violates
 * unique constraint" errors on subsequent inserts (e.g. countries PK).
 */
export class ResyncIdSequences1752595200000 implements MigrationInterface {
  name = 'ResyncIdSequences1752595200000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      DO $$
      DECLARE
        rec RECORD;
      BEGIN
        FOR rec IN
          SELECT
            quote_ident(t.relname) AS table_name,
            quote_ident(a.attname) AS column_name,
            pg_get_serial_sequence(quote_ident(t.relname), a.attname) AS seq_name
          FROM pg_class t
          JOIN pg_attribute a ON a.attrelid = t.oid
          JOIN pg_namespace n ON n.oid = t.relnamespace
          WHERE n.nspname = 'public'
            AND t.relkind = 'r'
            AND a.attnum > 0
            AND NOT a.attisdropped
            AND pg_get_serial_sequence(quote_ident(t.relname), a.attname) IS NOT NULL
        LOOP
          EXECUTE format(
            'SELECT setval(%L, GREATEST(COALESCE((SELECT MAX(%s) FROM %s), 0), 1), COALESCE((SELECT MAX(%s) FROM %s), 0) > 0)',
            rec.seq_name,
            rec.column_name,
            rec.table_name,
            rec.column_name,
            rec.table_name
          );
        END LOOP;
      END $$;
    `);
  }

  public async down(): Promise<void> {
    // Sequence resync is not reversible (and reverting it would only
    // reintroduce the duplicate key errors).
  }
}
