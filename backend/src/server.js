import Fastify from 'fastify';
import fastifyCookie from '@fastify/cookie';
import fastifyJwt from '@fastify/jwt';
import fastifyStatic from '@fastify/static';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { runMigrations } from './db.js';
import authRoutes from './routes/auth.js';
import foodsRoutes from './routes/foods.js';
import recipesRoutes from './routes/recipes.js';
import entriesRoutes from './routes/entries.js';
import settingsRoutes from './routes/settings.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
// Seul le dossier public/ est servi : jamais le code du backend.
const publicRoot = path.join(__dirname, '..', '..', 'public');

const fastify = Fastify({ logger: true });

await fastify.register(fastifyCookie);
await fastify.register(fastifyJwt, {
  secret: process.env.JWT_SECRET || 'dev-secret-change-me',
  cookie: { cookieName: 'token', signed: false },
});

await fastify.register(authRoutes);
await fastify.register(foodsRoutes);
await fastify.register(recipesRoutes);
await fastify.register(entriesRoutes);
await fastify.register(settingsRoutes);

await fastify.register(fastifyStatic, {
  root: publicRoot,
  index: ['kcal-el.dc.html'],
  // La page, le service worker et le manifeste doivent toujours être
  // revalidés pour que les mises à jour de l'app arrivent sans délai.
  setHeaders(reply, filePath) {
    if (/(\.html|sw\.js|\.webmanifest)$/.test(filePath)) {
      reply.header('Cache-Control', 'no-cache');
    }
  },
});

const port = Number(process.env.PORT) || 3000;

try {
  await runMigrations();
  await fastify.listen({ port, host: '0.0.0.0' });
} catch (err) {
  fastify.log.error(err);
  process.exit(1);
}
