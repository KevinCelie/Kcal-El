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
}
