import bcrypt from 'bcryptjs';
import { pool } from '../db.js';
import { authenticate } from '../auth.js';

const COOKIE_OPTS = {
  path: '/',
  httpOnly: true,
  sameSite: 'lax',
  secure: process.env.COOKIE_SECURE === 'true',
};

export default async function authRoutes(fastify) {
  fastify.post('/api/auth/signup', async (request, reply) => {
    const { email, password } = request.body || {};
    if (!email || !password || password.length < 8) {
      return reply.code(400).send({ error: 'email and password (min 8 chars) required' });
    }
    const existing = await pool.query('SELECT id FROM users WHERE email = $1', [email.toLowerCase()]);
    if (existing.rows.length) return reply.code(409).send({ error: 'email already registered' });

    const passwordHash = await bcrypt.hash(password, 10);
    const { rows } = await pool.query(
      'INSERT INTO users (email, password_hash) VALUES ($1, $2) RETURNING id, email',
      [email.toLowerCase(), passwordHash]
    );
    const user = rows[0];
    await pool.query('INSERT INTO user_settings (user_id) VALUES ($1)', [user.id]);

    const token = fastify.jwt.sign({ sub: user.id });
    reply.setCookie('token', token, COOKIE_OPTS);
    return { id: user.id, email: user.email };
  });

  fastify.post('/api/auth/login', async (request, reply) => {
    const { email, password } = request.body || {};
    if (!email || !password) return reply.code(400).send({ error: 'email and password required' });

    const { rows } = await pool.query('SELECT id, email, password_hash FROM users WHERE email = $1', [email.toLowerCase()]);
    const user = rows[0];
    if (!user || !(await bcrypt.compare(password, user.password_hash))) {
      return reply.code(401).send({ error: 'invalid credentials' });
    }

    const token = fastify.jwt.sign({ sub: user.id });
    reply.setCookie('token', token, COOKIE_OPTS);
    return { id: user.id, email: user.email };
  });

  fastify.post('/api/auth/logout', async (request, reply) => {
    reply.clearCookie('token', { path: '/' });
    return { ok: true };
  });

  fastify.get('/api/me', { preHandler: authenticate }, async (request) => {
    const { rows } = await pool.query('SELECT id, email FROM users WHERE id = $1', [request.user.sub]);
    return rows[0] || null;
  });
}
