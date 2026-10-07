import { DataSource } from 'typeorm';

/**
 * Fixes all PostgreSQL sequences that are out of sync with their table data
 * This should be run after data imports or when sequences get out of sync
 * 
 * @param dataSource - TypeORM DataSource instance
 */
export async function fixAllSequences(dataSource: DataSource): Promise<void> {
  const queryRunner = dataSource.createQueryRunner();
  
  try {
    
    // Get all sequences in the public schema
    const sequences = await queryRunner.query(`
      SELECT 
        schemaname,
        sequencename,
        REPLACE(sequencename, '_id_seq', '') as potential_table
      FROM pg_sequences
      WHERE schemaname = 'public'
      AND sequencename LIKE '%_id_seq'
      ORDER BY sequencename
    `);

    let fixedCount = 0;
    let okCount = 0;
    let errorCount = 0;

    for (const seq of sequences) {
      const tableName = seq.potential_table;
      
      try {
        // Check if table exists
        const tableExists = await queryRunner.query(`
          SELECT 1 
          FROM information_schema.tables 
          WHERE table_schema = 'public' 
          AND table_name = $1
        `, [tableName]);

        if (tableExists.length === 0) {
          continue;
        }

        // Get the column name that uses this sequence
        const columnResult = await queryRunner.query(`
          SELECT column_name 
          FROM information_schema.columns
          WHERE table_schema = 'public'
          AND table_name = $1
          AND column_default LIKE '%' || $2 || '%'
          LIMIT 1
        `, [tableName, seq.sequencename]);

        if (columnResult.length === 0) {
          continue;
        }

        const columnName = columnResult[0].column_name;

        // Get max ID from table
        const maxIdResult = await queryRunner.query(`
          SELECT COALESCE(MAX("${columnName}"), 0) as max_id 
          FROM "${tableName}"
        `);
        const maxId = parseInt(maxIdResult[0].max_id) || 0;

        // Get current sequence value
        const currentSeqResult = await queryRunner.query(`
          SELECT last_value FROM "${seq.schemaname}"."${seq.sequencename}"
        `);
        const currentSeqVal = parseInt(currentSeqResult[0].last_value) || 0;

        // Only fix if sequence is behind
        if (currentSeqVal < maxId) {
          await queryRunner.query(`
            SELECT setval('${seq.schemaname}.${seq.sequencename}', ${maxId}, true)
          `);
          
          fixedCount++;
        } else {
          okCount++;
        }
      } catch (error) {
        console.error(`⚠️  ERROR processing ${seq.sequencename}:`, error);
        errorCount++;
      }
    }


    if (errorCount > 0) {
      console.log(`Errors: ${errorCount} sequences`);
    }
  } catch (error) {
    console.error('❌ Error fixing sequences:', error);
    throw error;
  } finally {
    await queryRunner.release();
  }
}

