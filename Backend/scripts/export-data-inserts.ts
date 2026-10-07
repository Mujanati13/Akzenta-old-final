import 'reflect-metadata';
import * as path from 'path';
import { AppDataSource } from '../src/database/data-source';
import { exportAllTablesAsInserts } from '../src/utils/export-data-inserts.util';

const DEFAULT_EXCLUDED_TABLES = ['migrations'];

function parseArgs(): { outputPath: string; excludeTables: string[] } {
  const args = process.argv.slice(2);
  const outputArg = args.find((arg) => arg.startsWith('--output='));
  const excludeArg = args.find((arg) => arg.startsWith('--exclude='));

  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  const defaultOutputPath = path.join(
    __dirname,
    '..',
    'exports',
    `data-export-${timestamp}.sql`,
  );

  const excludeTables = excludeArg
    ? excludeArg
        .replace('--exclude=', '')
        .split(',')
        .map((table) => table.trim())
        .filter(Boolean)
    : DEFAULT_EXCLUDED_TABLES;

  return {
    outputPath: outputArg ? outputArg.replace('--output=', '') : defaultOutputPath,
    excludeTables,
  };
}

async function run(): Promise<void> {
  const { outputPath, excludeTables } = parseArgs();

  try {
    await AppDataSource.initialize();
    console.log(`🔄 Exporting data from database "${AppDataSource.options.database}"...`);
    if (excludeTables.length) {
      console.log(`ℹ️  Excluding tables: ${excludeTables.join(', ')}`);
    }

    const result = await exportAllTablesAsInserts(AppDataSource, {
      outputPath,
      excludeTables,
    });

    console.log(`✅ Exported ${result.rowCount} row(s) from ${result.tableCount} table(s)`);
    console.log(`📄 Output file: ${result.filePath}`);
  } catch (error) {
    console.error('❌ Error exporting data:', error);
    process.exit(1);
  } finally {
    if (AppDataSource.isInitialized) {
      await AppDataSource.destroy();
    }
    process.exit(0);
  }
}

run();
