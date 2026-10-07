require('dotenv').config();
const { Client } = require('pg');

const c = new Client({
  connectionString: process.env.DATABASE_URL || undefined,
  host: process.env.DATABASE_HOST,
  port: Number(process.env.DATABASE_PORT || 5432),
  user: process.env.DATABASE_USERNAME,
  password: process.env.DATABASE_PASSWORD,
  database: process.env.DATABASE_NAME,
});

async function main() {
  await c.connect();

  const userIds = [1111, 1121, 1123, 1124, 1125, 1127, 1128, 1149, 1169, 1196, 1199];

  // Get IDs of direct children
  const { rows: akzRows } = await c.query('SELECT id FROM public.akzente WHERE user_id = ANY($1)', [userIds]);
  const akzIds = akzRows.map(r => r.id);
  const { rows: merchRows } = await c.query('SELECT id FROM public.merchandiser WHERE user_id = ANY($1)', [userIds]);
  const merchIds = merchRows.map(r => r.id);

  console.log('akzente ids:', akzIds);
  console.log('merchandiser ids:', merchIds);

  // All FK relationships in the public schema
  const { rows: fks } = await c.query(`
    SELECT tc.table_name AS child, kcu.column_name AS child_col,
           ccu.table_name AS parent
    FROM information_schema.table_constraints tc
    JOIN information_schema.key_column_usage kcu ON tc.constraint_name = kcu.constraint_name
    JOIN information_schema.constraint_column_usage ccu ON ccu.constraint_name = tc.constraint_name
    WHERE tc.constraint_type = 'FOREIGN KEY' AND tc.table_schema = 'public'
  `);

  // Build transitive closure of tables referencing 'user'
  const children = {};
  for (const fk of fks) {
    if (!children[fk.parent]) children[fk.parent] = [];
    children[fk.parent].push({ table: fk.child, column: fk.child_col });
  }
  const affected = new Set();
  function visit(t) { if (!affected.has(t)) { affected.add(t); if (children[t]) children[t].forEach(c => visit(c.table)); } }
  visit('user');

  // Topological sort
  function topoSort(tables) {
    const graph = {};
    for (const t of tables) graph[t] = new Set();
    for (const fk of fks)
      if (tables.has(fk.child) && tables.has(fk.parent))
        graph[fk.child].add(fk.parent);
    const order = [], visited = new Set();
    function dfs(node) { if (!visited.has(node)) { visited.add(node); for (const d of graph[node]) dfs(d); order.push(node); } }
    for (const t of tables) dfs(t);
    return order;
  }
  const order = topoSort(affected).reverse(); // children first → safe for deletion

  // For each table in order, find which FK column links to an affected parent,
  // and use that parent's ID list
  const parentIds = { user: userIds, akzente: akzIds, merchandiser: merchIds, client: [] };

  // Propagate IDs transitively for remaining tables
  for (const table of order) {
    if (parentIds[table]) continue; // already known
    const refs = fks.filter(fk => fk.child === table && affected.has(fk.parent));
    for (const ref of refs) {
      if (parentIds[ref.parent] && parentIds[ref.parent].length) {
        const { rows } = await c.query(`SELECT "${ref.child_col}" AS id FROM public."${table}" WHERE "${ref.child_col}" = ANY($1) LIMIT 1`, [parentIds[ref.parent]]);
        if (rows.length > 0) {
          parentIds[table] = parentIds[ref.parent]; // reuse parent IDs for deletion
          console.log(`  ${table} via ${ref.child_col} → ${ref.parent}`);
          break;
        }
      }
    }
  }

  // Build delete steps: for each table, find the FK to the closest affected parent
  const deleteSteps = [];
  for (const table of order) {
    if (table === 'user') continue;
    const refs = fks.filter(fk => fk.child === table && affected.has(fk.parent));
    for (const ref of refs) {
      const ids = parentIds[ref.parent];
      if (ids && ids.length) {
        const { rows: cnt } = await c.query(`SELECT COUNT(*)::int AS c FROM public."${table}" WHERE "${ref.child_col}" = ANY($1)`, [ids]);
        if (cnt[0].c > 0) {
          deleteSteps.push({ table, column: ref.child_col, param: ids, count: cnt[0].c });
          break;
        }
      }
    }
  }

  console.log('\nDelete plan:');
  for (const s of deleteSteps) console.log(`  ${s.table}.${s.column} → ${s.count} rows`);
  console.log(`  user.id → ${userIds.length} rows`);

  console.log('\n⚠️  Proceeding in 5s... (Ctrl+C to abort)');
  await new Promise(r => setTimeout(r, 5000));

  for (const s of deleteSteps) {
    const r = await c.query(`DELETE FROM public."${s.table}" WHERE "${s.column}" = ANY($1)`, [s.param]);
    if (r.rowCount > 0) console.log(`  Deleted ${r.rowCount} from ${s.table}`);
  }
  const r = await c.query('DELETE FROM public."user" WHERE id = ANY($1)', [userIds]);
  console.log(`  Deleted ${r.rowCount} from user`);

  console.log('Done.');
  await c.end();
}

main().catch(e => { console.error(e.message); process.exit(1); });
