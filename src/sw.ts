/// <reference lib="webworker" />

const CACHE_VERSION = 'v1';
const STATIC_CACHE = `pocket-prompt-static-${CACHE_VERSION}`;
const DYNAMIC_CACHE = `pocket-prompt-dynamic-${CACHE_VERSION}`;
const ARWEAVE_CACHE = `pocket-prompt-arweave-${CACHE_VERSION}`;

const STATIC_ASSETS = [
  '/',
  '/index.html',
  '/manifest.json',
  '/icon-192.png',
  '/icon-512.png'
];

const sw = self as unknown as ServiceWorkerGlobalScope;

// Install event - cache static assets
sw.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(STATIC_CACHE).then((cache) => {
      return cache.addAll(STATIC_ASSETS);
    }).then(() => sw.skipWaiting())
  );
});

// Activate event - clean up old caches
sw.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames
          .filter((name) => name.startsWith('pocket-prompt-') && name !== STATIC_CACHE && name !== DYNAMIC_CACHE && name !== ARWEAVE_CACHE)
          .map((name) => caches.delete(name))
      );
    }).then(() => sw.clients.claim())
  );
});

// Fetch event - implement caching strategies
sw.addEventListener('fetch', (event) => {
  const { request } = event;
  const url = new URL(request.url);

  // Cache-first for static assets
  if (STATIC_ASSETS.some(asset => url.pathname === asset) ||
      request.destination === 'style' ||
      request.destination === 'script' ||
      request.destination === 'font') {
    event.respondWith(cacheFirst(request, STATIC_CACHE));
    return;
  }

  // Stale-while-revalidate for Arweave data (prompts, profiles)
  if (url.hostname.includes('arweave.net') || url.hostname.includes('ar.io')) {
    event.respondWith(staleWhileRevalidate(request, ARWEAVE_CACHE));
    return;
  }

  // Network-first for GraphQL queries
  if (url.pathname.includes('graphql')) {
    event.respondWith(networkFirst(request, DYNAMIC_CACHE));
    return;
  }

  // Network-first with fallback for everything else
  event.respondWith(networkFirst(request, DYNAMIC_CACHE));
});

// Cache-first strategy
async function cacheFirst(request: Request, cacheName: string): Promise<Response> {
  const cached = await caches.match(request);
  if (cached) {
    return cached;
  }

  try {
    const response = await fetch(request);
    if (response.ok) {
      const cache = await caches.open(cacheName);
      cache.put(request, response.clone());
    }
    return response;
  } catch (error) {
    return new Response('Offline', { status: 503, statusText: 'Service Unavailable' });
  }
}

// Network-first strategy
async function networkFirst(request: Request, cacheName: string): Promise<Response> {
  try {
    const response = await fetch(request);
    if (response.ok) {
      const cache = await caches.open(cacheName);
      cache.put(request, response.clone());
    }
    return response;
  } catch (error) {
    const cached = await caches.match(request);
    if (cached) {
      return cached;
    }
    return new Response('Offline', { status: 503, statusText: 'Service Unavailable' });
  }
}

// Stale-while-revalidate strategy
async function staleWhileRevalidate(request: Request, cacheName: string): Promise<Response> {
  const cached = await caches.match(request);

  const fetchPromise = fetch(request).then((response) => {
    if (response.ok) {
      const cache = caches.open(cacheName);
      cache.then(c => c.put(request, response.clone()));
    }
    return response;
  }).catch(() => {
    // Network failed, return cached if available
    return cached || new Response('Offline', { status: 503, statusText: 'Service Unavailable' });
  });

  return cached || fetchPromise;
}

// Background sync for queued uploads
// Note: Background Sync API support varies by browser
// This feature can be enabled when broader support is available
// sw.addEventListener('sync', (event: any) => {
//   if (event.tag === 'upload-prompt') {
//     event.waitUntil(syncUploadQueue());
//   }
// });

// async function syncUploadQueue(): Promise<void> {
//   // Implementation for background sync of queued uploads
//   // This would integrate with IndexedDB to store pending uploads
//   console.log('Syncing upload queue...');
// }
