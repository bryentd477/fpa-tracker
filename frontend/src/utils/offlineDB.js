// IndexedDB for offline data persistence
const DB_NAME = 'fpa-tracker';
const DB_VERSION = 1;

let db = null;

export function initializeOfflineDB() {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);

    request.onerror = () => {
      console.error('IndexedDB error:', request.error);
      reject(request.error);
    };

    request.onsuccess = () => {
      db = request.result;
      console.log('IndexedDB initialized');
      resolve(db);
    };

    request.onupgradeneeded = (event) => {
      const database = event.target.result;

      // Create object stores if they don't exist
      if (!database.objectStoreNames.contains('fpas')) {
        database.createObjectStore('fpas', { keyPath: 'id' });
      }
      if (!database.objectStoreNames.contains('activities')) {
        database.createObjectStore('activities', { keyPath: 'id' });
      }
      if (!database.objectStoreNames.contains('renewals')) {
        database.createObjectStore('renewals', { keyPath: 'id' });
      }
      if (!database.objectStoreNames.contains('syncQueue')) {
        database.createObjectStore('syncQueue', { keyPath: 'id', autoIncrement: true });
      }
      if (!database.objectStoreNames.contains('lastSync')) {
        database.createObjectStore('lastSync', { keyPath: 'key' });
      }
    };
  });
}

export async function saveToOfflineDB(storeName, data) {
  if (!db) await initializeOfflineDB();

  return new Promise((resolve, reject) => {
    const transaction = db.transaction([storeName], 'readwrite');
    const store = transaction.objectStore(storeName);
    const request = store.put(data);

    request.onerror = () => reject(request.error);
    request.onsuccess = () => resolve(request.result);
  });
}

export async function getFromOfflineDB(storeName, key) {
  if (!db) await initializeOfflineDB();

  return new Promise((resolve, reject) => {
    const transaction = db.transaction([storeName], 'readonly');
    const store = transaction.objectStore(storeName);
    const request = store.get(key);

    request.onerror = () => reject(request.error);
    request.onsuccess = () => resolve(request.result);
  });
}

export async function getAllFromOfflineDB(storeName) {
  if (!db) await initializeOfflineDB();

  return new Promise((resolve, reject) => {
    const transaction = db.transaction([storeName], 'readonly');
    const store = transaction.objectStore(storeName);
    const request = store.getAll();

    request.onerror = () => reject(request.error);
    request.onsuccess = () => resolve(request.result || []);
  });
}

export async function deleteFromOfflineDB(storeName, key) {
  if (!db) await initializeOfflineDB();

  return new Promise((resolve, reject) => {
    const transaction = db.transaction([storeName], 'readwrite');
    const store = transaction.objectStore(storeName);
    const request = store.delete(key);

    request.onerror = () => reject(request.error);
    request.onsuccess = () => resolve();
  });
}

export async function clearOfflineDB(storeName) {
  if (!db) await initializeOfflineDB();

  return new Promise((resolve, reject) => {
    const transaction = db.transaction([storeName], 'readwrite');
    const store = transaction.objectStore(storeName);
    const request = store.clear();

    request.onerror = () => reject(request.error);
    request.onsuccess = () => resolve();
  });
}

export async function addToSyncQueue(method, url, data) {
  if (!db) await initializeOfflineDB();

  return new Promise((resolve, reject) => {
    const transaction = db.transaction(['syncQueue'], 'readwrite');
    const store = transaction.objectStore('syncQueue');
    const request = store.add({
      method,
      url,
      data,
      timestamp: Date.now(),
      synced: false
    });

    request.onerror = () => reject(request.error);
    request.onsuccess = () => resolve(request.result);
  });
}

export async function getSyncQueue() {
  if (!db) await initializeOfflineDB();

  return new Promise((resolve, reject) => {
    const transaction = db.transaction(['syncQueue'], 'readonly');
    const store = transaction.objectStore('syncQueue');
    const request = store.getAll();

    request.onerror = () => reject(request.error);
    request.onsuccess = () => resolve(request.result || []);
  });
}

export async function removeSyncQueueItem(id) {
  if (!db) await initializeOfflineDB();

  return new Promise((resolve, reject) => {
    const transaction = db.transaction(['syncQueue'], 'readwrite');
    const store = transaction.objectStore('syncQueue');
    const request = store.delete(id);

    request.onerror = () => reject(request.error);
    request.onsuccess = () => resolve();
  });
}

export async function setLastSync(key, timestamp) {
  if (!db) await initializeOfflineDB();

  return new Promise((resolve, reject) => {
    const transaction = db.transaction(['lastSync'], 'readwrite');
    const store = transaction.objectStore('lastSync');
    const request = store.put({ key, timestamp });

    request.onerror = () => reject(request.error);
    request.onsuccess = () => resolve();
  });
}

export async function getLastSync(key) {
  if (!db) await initializeOfflineDB();

  return new Promise((resolve, reject) => {
    const transaction = db.transaction(['lastSync'], 'readonly');
    const store = transaction.objectStore('lastSync');
    const request = store.get(key);

    request.onerror = () => reject(request.error);
    request.onsuccess = () => resolve(request.result?.timestamp || null);
  });
}
