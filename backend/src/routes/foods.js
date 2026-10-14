import { pool } from '../db.js';
import { authenticate } from '../auth.js';

export default async function foodsRoutes(fastify) {
  fastify.addHook('preHandler', authenticate);

  fastify.get('/api/foods', async (request) => {
    // Les aliments sont communs à tous les utilisateurs.
    const q = (request.query.q || '').trim();
    if (q) {
      const { rows } = await pool.query(
        `SELECT id, name, kcal_per_100g, barcode, portion_grams FROM foods
         WHERE name ILIKE $1
         ORDER BY name ASC LIMIT 50`,
        [`%${q}%`]
      );
      return rows;
    }
    const { rows } = await pool.query(
      `SELECT id, name, kcal_per_100g, barcode, portion_grams FROM foods ORDER BY name ASC`
    );
    return rows;
  });

  fastify.post('/api/foods', async (request, reply) => {
    const { name, kcal_per_100g, barcode, portion_grams } = request.body || {};
    if (!name || typeof kcal_per_100g !== 'number' || kcal_per_100g < 0) {
      return reply.code(400).send({ error: 'name and kcal_per_100g (>=0) required' });
    }
    const id = 'u' + Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
    const { rows } = await pool.query(
      'INSERT INTO foods (id, user_id, name, kcal_per_100g, barcode, portion_grams) VALUES ($1, $2, $3, $4, $5, $6) RETURNING id, name, kcal_per_100g, barcode, portion_grams',
      [id, request.user.sub, name, kcal_per_100g, barcode || null, portion_grams || 100]
    );
    return rows[0];
  });

  fastify.patch('/api/foods/:id', async (request, reply) => {
    const { name, kcal_per_100g, barcode, portion_grams } = request.body || {};
    const { rows } = await pool.query(
      `UPDATE foods SET name = COALESCE($1, name), kcal_per_100g = COALESCE($2, kcal_per_100g), barcode = $3, portion_grams = COALESCE($4, portion_grams)
       WHERE id = $5 RETURNING id, name, kcal_per_100g, barcode, portion_grams`,
      [name ?? null, kcal_per_100g ?? null, barcode ?? null, portion_grams ?? null, request.params.id]
    );
    if (!rows.length) return reply.code(404).send({ error: 'not found' });
    return rows[0];
  });

  fastify.delete('/api/foods/:id', async (request, reply) => {
    const { rowCount } = await pool.query('DELETE FROM foods WHERE id = $1', [request.params.id]);
    if (!rowCount) return reply.code(404).send({ error: 'not found' });
    return { ok: true };
  });
}
