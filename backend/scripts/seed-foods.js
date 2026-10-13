// Import MANUEL de la base d'aliments initiale (public/foods-data.js).
// Plus lancé au démarrage : la base de données est la source de vérité.
// À n'utiliser que pour peupler une base vide (nouveau serveur) ; n'écrase
// jamais un aliment existant.
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { pool, runMigrations } from '../src/db.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

function loadSeedFoods() {
  const src = readFileSync(path.join(__dirname, '..', '..', 'public', 'foods-data.js'), 'utf8');
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
        `INSERT INTO foods (id, user_id, name, kcal_per_100g, portion_grams)
         VALUES ($1, NULL, $2, $3, $4)
         ON CONFLICT (id) DO NOTHING`,
        [f.id, f.name, f.kcal, f.portionGrams || 100]
      );
    }
    await client.query('COMMIT');
    console.log(`[seed] ${foods.length} aliments lus ; seuls les manquants ont été insérés`);
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
