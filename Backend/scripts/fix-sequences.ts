import 'reflect-metadata';
import { AppDataSource } from '../src/database/data-source';
import { fixAllSequences } from '../src/utils/fix-sequences.util';

async function run() {
  try {
    await AppDataSource.initialize();
    await fixAllSequences(AppDataSource);
  } catch (error) {
    console.error('❌ Error:', error);
    process.exit(1);
  } finally {
    if (AppDataSource.isInitialized) {
      await AppDataSource.destroy();
    }
    process.exit(0);
  }
}

run();

