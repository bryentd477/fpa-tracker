const CACHE_NAME = 'fpa-tracker-v1';
const urlsToCache = [
  '/',
  '/index.html',
  '/manifest.json'
];

// Install event - cache files
self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME).then(cache => {
      return cache.addAll(urlsToCache).catch(err => {
        console.log('Cache addAll error:', err);
        // Continue even if some files fail to cache
      });
    })
  );
  self.skipWaiting();
});

// Activate event - clean up old caches
self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(cacheNames => {
      return Promise.all(
        cacheNames.map(cacheName => {
          if (cacheName !== CACHE_NAME) {
            return caches.delete(cacheName);
          }
        })
      );
    })
  );
  self.clients.claim();
});

// Fetch event - serve from cache, fallback to network
self.addEventListener('fetch', event => {
  const { request } = event;

  // Skip non-GET requests
  if (request.method !== 'GET') {
    return;
  }

  // For API calls, try network first, then cache
  if (request.url.includes('/api/')) {
    event.respondWith(
      fetch(request)
        .then(response => {
          // Cache successful API responses
          if (response.ok) {
            const responseToCache = response.clone();
            caches.open(CACHE_NAME).then(cache => {
              cache.put(request, responseToCache);
            });
          }
          return response;
        })
        .catch(() => {
          // If network fails, try cache
          return caches.match(request).then(cached => {
            return cached || new Response(
              JSON.stringify({ offline: true, error: 'Network unavailable' }),
              { status: 503, headers: { 'Content-Type': 'application/json' } }
            );
          });
        })
    );
  } else {
    // For static assets, use cache-first strategy
    event.respondWith(
      caches.match(request).then(response => {
        return response || fetch(request).then(response => {
          // Cache successful responses
          if (response.ok) {
            const responseToCache = response.clone();
            caches.open(CACHE_NAME).then(cache => {
              cache.put(request, responseToCache);
            });
          }
          return response;
        }).catch(() => {
          // Return offline page if available
          return caches.match('/index.html');
        });
      })
    );
  }
});

// Background sync for offline changes
self.addEventListener('sync', event => {
  if (event.tag === 'sync-fpa-data') {
    event.waitUntil(syncFPAData());
  }
});

async function syncFPAData() {
  try {
    const db = openIndexedDB();
    const pendingChanges = await getPendingChanges(db);
    
    for (const change of pendingChanges) {
      try {
        await fetch(change.url, {
          method: change.method,
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(change.data)
        });
        await markChangeAsSynced(db, change.id);
      } catch (error) {
        console.error('Failed to sync change:', error);
      }
    }
  } catch (error) {
    console.error('Sync error:', error);
  }
}

function openIndexedDB() {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open('fpa-tracker', 1);
    request.onerror = () => reject(request.error);
    request.onsuccess = () => resolve(request.result);
  });
}

function getPendingChanges(db) {
  return new Promise((resolve, reject) => {
    const transaction = db.transaction(['pendingChanges'], 'readonly');
    const store = transaction.objectStore('pendingChanges');
    const request = store.getAll();
    request.onerror = () => reject(request.error);
    request.onsuccess = () => resolve(request.result);
  });
}

function markChangeAsSynced(db, id) {
  return new Promise((resolve, reject) => {
    const transaction = db.transaction(['pendingChanges'], 'readwrite');
    const store = transaction.objectStore('pendingChanges');
    const request = store.delete(id);
    request.onerror = () => reject(request.error);
    request.onsuccess = () => resolve();
  });
}
