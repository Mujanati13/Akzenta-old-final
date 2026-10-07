import * as fs from 'fs';
import * as path from 'path';
import { DataSource } from 'typeorm';

export interface ExportDataOptions {
  /** Absolute (or relative) path of the .sql file to write. */
  outputPath: string;
  /** Table names (case-insensitive) to skip entirely. */
  excludeTables?: string[];
  /** Number of rows grouped into a single multi-row INSERT statement. */
  batchSize?: number;
}

export interface ExportDataResult {
  filePath: string;
  tableCount: number;
  rowCount: number;
}

/**
 * Dumps every row of every table in the `public` schema as plain SQL
 * INSERT statements (data only, no schema/DDL). Foreign-key/trigger
 * checks are disabled for the duration of the import so tables can be
 * inserted in any order, mirroring what `pg_dump --data-only` produces.
 */
export async function exportAllTablesAsInserts(
  dataSource: DataSource,
  options: ExportDataOptions,
): Promise<ExportDataResult> {
  const excludeTables = new Set(
    (options.excludeTables ?? []).map((table) => table.toLowerCase()),
  );
  const batchSize = options.batchSize ?? 500;

  fs.mkdirSync(path.dirname(options.outputPath), { recursive: true });
  const stream = fs.createWriteStream(options.outputPath, { encoding: 'utf8' });
  const write = (text: string): Promise<void> =>
    new Promise((resolve, reject) => {
      stream.write(text, (err) => (err ? reject(err) : resolve()));
    });

  const queryRunner = dataSource.createQueryRunner();
  let tableCount = 0;
  let rowCount = 0;

  try {
    const tables: { table_name: string }[] = await queryRunner.query(`
      SELECT table_name
      FROM information_schema.tables
      WHERE table_schema = 'public' AND table_type = 'BASE TABLE'
      ORDER BY table_name
    `);

    await write(`-- Data export generated on ${new Date().toISOString()}\n`);
    await write(`-- Source database: ${dataSource.options.database}\n\n`);
    await write('BEGIN;\n');
    await write("SET session_replication_role = 'replica';\n\n");

    for (const { table_name: tableName } of tables) {
      if (excludeTables.has(tableName.toLowerCase())) {
        await write(`-- Skipped table "${tableName}" (excluded)\n\n`);
        continue;
      }

      const rows: Record<string, unknown>[] = await queryRunner.query(
        `SELECT * FROM "${tableName}"`,
      );
      tableCount++;

      if (rows.length === 0) {
        await write(`-- Table "${tableName}" has no data\n\n`);
        continue;
      }

      const columns = Object.keys(rows[0]);
      await write(
        `-- Table "${tableName}" (${rows.length} row${rows.length === 1 ? '' : 's'})\n`,
      );

      for (const statement of buildInsertStatements(tableName, columns, rows, batchSize)) {
        await write(`${statement}\n`);
      }
      await write('\n');

      rowCount += rows.length;
    }

    await write("SET session_replication_role = 'origin';\n");
    await write('COMMIT;\n');
  } finally {
    await new Promise<void>((resolve) => stream.end(resolve));
    await queryRunner.release();
  }

  return { filePath: options.outputPath, tableCount, rowCount };
}

function buildInsertStatements(
  tableName: string,
  columns: string[],
  rows: Record<string, unknown>[],
  batchSize: number,
): string[] {
  const quotedColumns = columns.map((column) => `"${column}"`).join(', ');
  const statements: string[] = [];

  for (let i = 0; i < rows.length; i += batchSize) {
    const batch = rows.slice(i, i + batchSize);
    const valuesSql = batch
      .map((row) => `(${columns.map((column) => formatSqlValue(row[column])).join(', ')})`)
      .join(',\n  ');
    statements.push(`INSERT INTO "${tableName}" (${quotedColumns}) VALUES\n  ${valuesSql};`);
  }

  return statements;
}

function formatSqlValue(value: unknown): string {
  if (value === null || value === undefined) {
    return 'NULL';
  }
  if (typeof value === 'boolean') {
    return value ? 'TRUE' : 'FALSE';
  }
  if (typeof value === 'number') {
    return Number.isFinite(value) ? String(value) : 'NULL';
  }
  if (typeof value === 'bigint') {
    return value.toString();
  }
  if (value instanceof Date) {
    return `'${value.toISOString()}'`;
  }
  if (Buffer.isBuffer(value)) {
    return `'\\x${value.toString('hex')}'`;
  }
  if (Array.isArray(value)) {
    return `'${escapeSqlString(formatPgArrayLiteral(value))}'`;
  }
  if (typeof value === 'object') {
    return `'${escapeSqlString(JSON.stringify(value))}'`;
  }
  return `'${escapeSqlString(String(value))}'`;
}

function formatPgArrayLiteral(values: unknown[]): string {
  return `{${values.map(formatPgArrayElement).join(',')}}`;
}

function formatPgArrayElement(value: unknown): string {
  if (value === null || value === undefined) {
    return 'NULL';
  }
  if (Array.isArray(value)) {
    return formatPgArrayLiteral(value);
  }
  const text = value instanceof Date ? value.toISOString() : String(value);
  return `"${text.replace(/\\/g, '\\\\').replace(/"/g, '\\"')}"`;
}

function escapeSqlString(text: string): string {
  return text.replace(/'/g, "''");
}
