import { pool } from '../db.js';
import { authenticate } from '../auth.js';

export default async function entriesRoutes(fastify) {
  fastify.addHook('preHandler', authenticate);

  // No `date` query param -> full history for the user (small enough for a
  // personal tracker, and needed client-side for stats/calendar/"recently used").
  fastify.get('/api/entries', async (request) => {
    const { date } = request.query;
    const sql = `SELECT id, date, meal, food_id, recipe_id, name, unit_mode, amount, kcal_total, is_recipe, recipe_snapshot, ts
       FROM journal_entries WHERE user_id = $1 ${date ? 'AND date = $2' : ''} ORDER BY ts ASC`;
    const params = date ? [request.user.sub, date] : [request.user.sub];
    const { rows } = await pool.query(sql, params);
    return rows;
  });

  fastify.post('/api/entries', async (request, reply) => {
    const { id, date, meal, food_id, recipe_id, name, unit_mode, amount, kcal_total, is_recipe, recipe_snapshot, ts } = request.body || {};
    if (!id || !date || !meal || !name || !unit_mode || amount == null || kcal_total == null) {
      return reply.code(400).send({ error: 'missing required entry fields' });
    }
    const { rows } = await pool.query(
      `INSERT INTO journal_entries (id, user_id, date, meal, food_id, recipe_id, name, unit_mode, amount, kcal_total, is_recipe, recipe_snapshot, ts)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13) RETURNING *`,
      [id, request.user.sub, date, meal, food_id || null, recipe_id || null, name, unit_mode, amount, kcal_total, !!is_recipe, recipe_snapshot ? JSON.stringify(recipe_snapshot) : null, ts || Date.now()]
    );
    return reply.code(201).send(rows[0]);
  });

  fastify.patch('/api/entries/:id', async (request, reply) => {
    const { amount, kcal_total, unit_mode } = request.body || {};
    const { rows } = await pool.query(
      `UPDATE journal_entries SET
         amount = COALESCE($1, amount),
         kcal_total = COALESCE($2, kcal_total),
         unit_mode = COALESCE($3, unit_mode)
       WHERE id = $4 AND user_id = $5 RETURNING *`,
      [amount ?? null, kcal_total ?? null, unit_mode ?? null, request.params.id, request.user.sub]
    );
    if (!rows.length) return reply.code(404).send({ error: 'not found or not owned' });
    return rows[0];
  });

  fastify.delete('/api/entries/:id', async (request, reply) => {
    const { rowCount } = await pool.query('DELETE FROM journal_entries WHERE id = $1 AND user_id = $2', [request.params.id, request.user.sub]);
    if (!rowCount) return reply.code(404).send({ error: 'not found or not owned' });
    return { ok: true };
  });
}
