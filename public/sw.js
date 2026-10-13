// Service worker de Kcal-El : met en cache l'interface (pas les données).
// Pour forcer la mise à jour du cache après un changement : incrémenter VERSION.
const VERSION = 'v1';
const SHELL_CACHE = `kcal-el-shell-${VERSION}`;
const RUNTIME_CACHE = `kcal-el-runtime-${VERSION}`;

const SHELL_URLS = [
  '/',
  '/support.js',
  '/foods-data.js',
  '/manifest.webmanifest',
  '/icons/icon-192.png',
  '/icons/icon-512.png',
];

const CDN_HOSTS = ['fonts.googleapis.com', 'fonts.gstatic.com', 'unpkg.com'];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(SHELL_CACHE).then((cache) => cache.addAll(SHELL_URLS)).then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(
          keys
            .filter((k) => k.startsWith('kcal-el-') && k !== SHELL_CACHE && k !== RUNTIME_CACHE)
            .map((k) => caches.delete(k))
        )
      )
      .then(() => self.clients.claim())
  );
});

// Réseau d'abord (mises à jour immédiates), cache en secours hors-ligne.
async function networkFirst(request, cacheName, fallbackUrl) {
  const cache = await caches.open(cacheName);
  try {
    const response = await fetch(request);
    if (response.ok) cache.put(fallbackUrl || request, response.clone());
    return response;
  } catch (err) {
    const cached = await cache.match(fallbackUrl || request);
    if (cached) return cached;
    throw err;
  }
}

// Cache d'abord, rafraîchi en arrière-plan.
async function staleWhileRevalidate(request, cacheName) {
  const cache = await caches.open(cacheName);
  const cached = await cache.match(request);
  const refresh = fetch(request)
    .then((response) => {
      if (response.ok || response.type === 'opaque') cache.put(request, response.clone());
      return response;
    })
    .catch(() => cached);
  return cached || refresh;
}

self.addEventListener('fetch', (event) => {
  const request = event.request;
  if (request.method !== 'GET') return;

  const url = new URL(request.url);

  // Données et authentification : jamais interceptées ni mises en cache.
  if (url.origin === self.location.origin && url.pathname.startsWith('/api/')) return;

  // Polices Google et React/Babel (unpkg, versions épinglées) : indispensables
  // au démarrage de l'app, donc servis depuis le cache (rafraîchi en fond).
  if (CDN_HOSTS.includes(url.hostname)) {
    event.respondWith(staleWhileRevalidate(request, RUNTIME_CACHE));
    return;
  }

  // Les autres origines (ex. Open Food Facts) ne sont pas gérées.
  if (url.origin !== self.location.origin) return;

  // Navigation : on sert toujours la page d'accueil de l'app.
  if (request.mode === 'navigate') {
    event.respondWith(networkFirst(request, SHELL_CACHE, '/'));
    return;
  }

  // Fichiers statiques de l'app : réseau d'abord, pour ne jamais mélanger
  // une ancienne version des scripts avec une nouvelle page.
  event.respondWith(networkFirst(request, SHELL_CACHE));
});
