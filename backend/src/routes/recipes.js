import { pool } from '../db.js';
import { authenticate } from '../auth.js';

async function loadRecipe(userId, recipeId) {
  const { rows: recipeRows } = await pool.query(
    'SELECT id, name, total_grams, kcal_per_100g, kcal_total FROM recipes WHERE id = $1 AND user_id = $2',
    [recipeId, userId]
  );
  if (!recipeRows.length) return null;
  const { rows: ingredients } = await pool.query(
    'SELECT id, food_id, name, grams, kcal_per_100g FROM recipe_ingredients WHERE recipe_id = $1',
    [recipeId]
  );
  return { ...recipeRows[0], ingredients };
}

export default async function recipesRoutes(fastify) {
  fastify.addHook('preHandler', authenticate);

  fastify.get('/api/recipes', async (request) => {
    const { rows } = await pool.query(
      'SELECT id FROM recipes WHERE user_id = $1 ORDER BY name ASC',
      [request.user.sub]
    );
    const recipes = [];
    for (const r of rows) recipes.push(await loadRecipe(request.user.sub, r.id));
    return recipes;
  });

  fastify.post('/api/recipes', async (request, reply) => {
    const { name, ingredients } = request.body || {};
    if (!name || !Array.isArray(ingredients) || ingredients.length === 0) {
      return reply.code(400).send({ error: 'name and non-empty ingredients required' });
    }
    const totalGrams = ingredients.reduce((sum, i) => sum + Number(i.grams || 0), 0);
    const kcalTotal = ingredients.reduce((sum, i) => sum + (Number(i.kcal_per_100g || 0) * Number(i.grams || 0)) / 100, 0);
    const kcalPer100g = totalGrams > 0 ? Math.round((kcalTotal / totalGrams) * 100) : 0;

    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      const { rows } = await client.query(
        `INSERT INTO recipes (user_id, name, total_grams, kcal_per_100g, kcal_total)
         VALUES ($1, $2, $3, $4, $5) RETURNING id`,
        [request.user.sub, name, totalGrams, kcalPer100g, Math.round(kcalTotal)]
      );
      const recipeId = rows[0].id;
      for (const ing of ingredients) {
        await client.query(
          'INSERT INTO recipe_ingredients (recipe_id, food_id, name, grams, kcal_per_100g) VALUES ($1, $2, $3, $4, $5)',
          [recipeId, ing.food_id || null, ing.name, ing.grams, ing.kcal_per_100g]
        );
      }
      await client.query('COMMIT');
      return reply.code(201).send(await loadRecipe(request.user.sub, recipeId));
    } catch (err) {
      await client.query('ROLLBACK');
      throw err;
    } finally {
      client.release();
    }
  });

  fastify.delete('/api/recipes/:id', async (request, reply) => {
    const { rowCount } = await pool.query('DELETE FROM recipes WHERE id = $1 AND user_id = $2', [request.params.id, request.user.sub]);
    if (!rowCount) return reply.code(404).send({ error: 'not found or not owned' });
    return { ok: true };
  });
}
