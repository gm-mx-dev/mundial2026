// Service Worker — Quiniela Mundial 2026
const CACHE_NAME = 'quiniela-2026-v1';

// Recursos a pre-cachear al instalar
const PRECACHE = ['/', '/manifest.json', '/icon-192.png', '/icon-512.png'];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(PRECACHE))
  );
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  // Eliminar cachés viejos
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((k) => k !== CACHE_NAME).map((k) => caches.delete(k)))
    )
  );
  self.clients.claim();
});

self.addEventListener('fetch', (event) => {
  // Solo interceptar navegación (no peticiones de API/Supabase)
  if (event.request.mode === 'navigate') {
    event.respondWith(
      fetch(event.request).catch(() =>
        // Sin conexión → servir la página principal del caché
        caches.match('/').then((cached) => cached || Response.error())
      )
    );
  }
});
