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

const allLanguages = [
  'Albanisch', 'Amharisch', 'Arabisch', 'Armenisch', 'Aserbaidschanisch',
  'Bengalisch', 'Bosnisch', 'Bulgarisch',
  'Chinesisch',
  'Dänisch', 'Deutsch',
  'Englisch', 'Estnisch',
  'Finnisch', 'Französisch',
  'Georgisch', 'Griechisch',
  'Hebräisch', 'Hindi',
  'Indonesisch', 'Italienisch',
  'Japanisch', 'Jiddisch',
  'Katalanisch', 'Koreanisch', 'Kroatisch', 'Kurdisch',
  'Lettisch', 'Litauisch',
  'Mazedonisch', 'Mongolisch',
  'Niederländisch', 'Norwegisch',
  'Paschtu', 'Persisch (Farsi)', 'Polnisch', 'Portugiesisch',
  'Rumänisch', 'Russisch',
  'Schwedisch', 'Serbisch', 'Slowakisch', 'Slowenisch', 'Spanisch',
  'Tamil', 'Thai', 'Tschechisch', 'Türkisch',
  'Ukrainisch', 'Ungarisch', 'Urdu',
  'Vietnamesisch',
];

async function main() {
  await c.connect();

  const { rows: existing } = await c.query('SELECT name FROM public.languages');
  const existingSet = new Set(existing.map(r => r.name));

  let added = 0;
  for (const lang of allLanguages) {
    if (!existingSet.has(lang)) {
      await c.query('INSERT INTO public.languages (name) VALUES ($1)', [lang]);
      console.log('  added: ' + lang);
      added++;
    }
  }

  if (added === 0) {
    console.log('All languages already exist in the database.');
  } else {
    console.log(`\nAdded ${added} new languages.`);
  }

  // Show final list
  const { rows: final } = await c.query('SELECT id, name FROM public.languages ORDER BY name');
  console.log('\nCurrent languages in DB:');
  final.forEach(r => console.log('  ' + r.id + ' = ' + r.name));

  await c.end();
}

main().catch(e => { console.error(e.message); process.exit(1); });
