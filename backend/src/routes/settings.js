import { pool } from '../db.js';
import { authenticate } from '../auth.js';

export default async function settingsRoutes(fastify) {
  fastify.addHook('preHandler', authenticate);

  fastify.get('/api/me/settings', async (request) => {
    const { rows } = await pool.query('SELECT goal, energy_unit, qty_step FROM user_settings WHERE user_id = $1', [request.user.sub]);
    return rows[0] || { goal: 2000, energy_unit: 'kcal', qty_step: 0.5 };
  });

  fastify.put('/api/me/settings', async (request) => {
    const { goal, energy_unit, qty_step } = request.body || {};
    const { rows } = await pool.query(
      `INSERT INTO user_settings (user_id, goal, energy_unit, qty_step)
       VALUES ($1, COALESCE($2, 2000), COALESCE($3, 'kcal'), COALESCE($4, 0.5))
       ON CONFLICT (user_id) DO UPDATE SET
         goal = COALESCE($2, user_settings.goal),
         energy_unit = COALESCE($3, user_settings.energy_unit),
         qty_step = COALESCE($4, user_settings.qty_step)
       RETURNING goal, energy_unit, qty_step`,
      [request.user.sub, goal ?? null, energy_unit ?? null, qty_step ?? null]
    );
    return rows[0];
  });

  fastify.get('/api/me/goal-history', async (request) => {
    const { rows } = await pool.query(
      'SELECT from_date AS "from", goal FROM goal_history WHERE user_id = $1 ORDER BY from_date ASC',
      [request.user.sub]
    );
    return rows;
  });

  fastify.put('/api/me/goal-history', async (request, reply) => {
    const { history } = request.body || {};
    const valid = Array.isArray(history) && history.every(
      (x) => x && /^\d{4}-\d{2}-\d{2}$/.test(x.from) && Number.isInteger(x.goal) && x.goal > 0
    );
    if (!valid) return reply.code(400).send({ error: 'history must be an array of {from: YYYY-MM-DD, goal: positive integer}' });

    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      await client.query('DELETE FROM goal_history WHERE user_id = $1', [request.user.sub]);
      for (const x of history) {
        await client.query(
          'INSERT INTO goal_history (user_id, from_date, goal) VALUES ($1, $2, $3) ON CONFLICT (user_id, from_date) DO UPDATE SET goal = EXCLUDED.goal',
          [request.user.sub, x.from, x.goal]
        );
      }
      await client.query('COMMIT');
      return { ok: true };
    } catch (err) {
      await client.query('ROLLBACK');
      throw err;
    } finally {
      client.release();
    }
  });
}
