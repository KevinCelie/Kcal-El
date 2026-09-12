import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { pool, runMigrations } from '../src/db.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

function loadSeedFoods() {
  const src = readFileSync(path.join(__dirname, '..', '..', 'foods-data.js'), 'utf8');
  const match = src.match(/window\.__SEED_FOODS__\s*=\s*(\[[\s\S]*\]);/);
  if (!match) throw new Error('Could not find __SEED_FOODS__ array in foods-data.js');
  return JSON.parse(match[1]);
}

async function main() {
  await runMigrations();
  const foods = loadSeedFoods();
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    for (const f of foods) {
      await client.query(
        `INSERT INTO foods (id, user_id, name, kcal_per_100g)
         VALUES ($1, NULL, $2, $3)
         ON CONFLICT (id) DO UPDATE SET name = EXCLUDED.name, kcal_per_100g = EXCLUDED.kcal_per_100g`,
        [f.id, f.name, f.kcal]
      );
    }
    await client.query('COMMIT');
    console.log(`[seed] upserted ${foods.length} global foods`);
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
    await pool.end();
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
