import { pool } from '../db.js';
import { authenticate } from '../auth.js';

export default async function foodsRoutes(fastify) {
  fastify.addHook('preHandler', authenticate);

  fastify.get('/api/foods', async (request) => {
    const q = (request.query.q || '').trim();
    const userId = request.user.sub;
    if (q) {
      const { rows } = await pool.query(
        `SELECT id, name, kcal_per_100g FROM foods
         WHERE (user_id IS NULL OR user_id = $1) AND name ILIKE $2
         ORDER BY name ASC LIMIT 50`,
        [userId, `%${q}%`]
      );
      return rows;
    }
    const { rows } = await pool.query(
      `SELECT id, name, kcal_per_100g FROM foods WHERE user_id IS NULL OR user_id = $1 ORDER BY name ASC`,
      [userId]
    );
    return rows;
  });

  fastify.post('/api/foods', async (request, reply) => {
    const { name, kcal_per_100g } = request.body || {};
    if (!name || typeof kcal_per_100g !== 'number' || kcal_per_100g < 0) {
      return reply.code(400).send({ error: 'name and kcal_per_100g (>=0) required' });
    }
    const id = 'u' + Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
    const { rows } = await pool.query(
      'INSERT INTO foods (id, user_id, name, kcal_per_100g) VALUES ($1, $2, $3, $4) RETURNING id, name, kcal_per_100g',
      [id, request.user.sub, name, kcal_per_100g]
    );
    return rows[0];
  });

  fastify.patch('/api/foods/:id', async (request, reply) => {
    const { name, kcal_per_100g } = request.body || {};
    const { rows } = await pool.query(
      `UPDATE foods SET name = COALESCE($1, name), kcal_per_100g = COALESCE($2, kcal_per_100g)
       WHERE id = $3 AND user_id = $4 RETURNING id, name, kcal_per_100g`,
      [name ?? null, kcal_per_100g ?? null, request.params.id, request.user.sub]
    );
    if (!rows.length) return reply.code(404).send({ error: 'not found or not owned' });
    return rows[0];
  });

  fastify.delete('/api/foods/:id', async (request, reply) => {
    const { rowCount } = await pool.query('DELETE FROM foods WHERE id = $1 AND user_id = $2', [request.params.id, request.user.sub]);
    if (!rowCount) return reply.code(404).send({ error: 'not found or not owned' });
    return { ok: true };
  });
}
