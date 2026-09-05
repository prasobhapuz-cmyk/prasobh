// Hybrid IndexedDB + Cloud Storage Service for Prasobh's Gallery
// Enables instant 0ms local rendering with automatic real-time cloud synchronization across devices

const DB_NAME = 'GeometryOfSilenceDB';
const DB_VERSION = 2;
const ALBUMS_STORE = 'albums';
const MEDIA_STORE = 'media';

// Production Cloud Bin ID on ExtendsClass
export const CLOUD_STORAGE_BIN_ID = 'bdbddaa';
export const CLOUD_STORAGE_URL = `https://extendsclass.com/api/json-storage/bin/${CLOUD_STORAGE_BIN_ID}`;

// Default starter place folders
export const DEFAULT_ALBUMS = [
  {
    id: 'folder-kyoto',
    title: 'Kyoto',
    location: 'Japan',
    coverImage: 'https://images.unsplash.com/photo-1493976040374-85c8e12f0c0e?q=80&w=1200&auto=format&fit=crop',
    description: 'Silence in stone, bamboo groves, and ancient wooden shrines.'
  },
  {
    id: 'folder-iceland',
    title: 'Iceland',
    location: 'Nordic Coast',
    coverImage: 'https://images.unsplash.com/photo-1504893524553-b855bce32c67?q=80&w=1200&auto=format&fit=crop',
    description: 'Basalt shores, glacial stillness, and volcanic horizons.'
  },
  {
    id: 'folder-amalfi',
    title: 'Amalfi',
    location: 'Italy',
    coverImage: 'https://images.unsplash.com/photo-1533105079780-92b9be482077?q=80&w=1200&auto=format&fit=crop',
    description: 'Cliffs meeting the sea under pure Mediterranean light.'
  }
];

export const DEFAULT_MEDIA = [];

// Track sync listeners for instant UI updates
const syncListeners = new Set();

export function onCloudSyncUpdated(callback) {
  syncListeners.add(callback);
  return () => syncListeners.delete(callback);
}

function notifySyncListeners(data) {
  syncListeners.forEach((cb) => {
    try {
      cb(data);
    } catch (e) {
      console.error('Sync listener error:', e);
    }
  });
}

function openDB() {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);

    request.onupgradeneeded = (event) => {
      const db = event.target.result;

      if (db.objectStoreNames.contains(ALBUMS_STORE)) {
        db.deleteObjectStore(ALBUMS_STORE);
      }
      if (db.objectStoreNames.contains(MEDIA_STORE)) {
        db.deleteObjectStore(MEDIA_STORE);
      }

      db.createObjectStore(ALBUMS_STORE, { keyPath: 'id' });
      const mediaStore = db.createObjectStore(MEDIA_STORE, { keyPath: 'id' });
      mediaStore.createIndex('albumId', 'albumId', { unique: false });
      mediaStore.createIndex('type', 'type', { unique: false });
    };

    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

// Push local data to the central cloud storage bin
export async function syncToCloud() {
  try {
    const albums = await getLocalAlbums();
    const media = await getLocalMedia();
    const payload = {
      albums,
      media,
      updatedAt: new Date().toISOString()
    };

    const res = await fetch(CLOUD_STORAGE_URL, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(payload)
    });

    if (res.ok) {
      localStorage.setItem('prasobh_last_cloud_sync', new Date().toISOString());
      return { success: true, timestamp: new Date().toISOString() };
    } else {
      console.warn('Cloud sync response error:', res.status);
      return { success: false, status: res.status };
    }
  } catch (err) {
    console.warn('Cloud sync push failed (network offline):', err);
    return { success: false, error: err.message };
  }
}

// Fetch the latest central cloud data and update local cache
export async function syncFromCloud() {
  try {
    const res = await fetch(CLOUD_STORAGE_URL + '?t=' + Date.now(), {
      headers: { 'Accept': 'application/json' },
      cache: 'no-store'
    });

    if (!res.ok) return null;

    const data = await res.json();
    if (data && Array.isArray(data.albums) && data.albums.length > 0) {
      // Overwrite/update local IndexedDB with latest cloud data
      const db = await openDB();
      await new Promise((resolve) => {
        const tx = db.transaction([ALBUMS_STORE, MEDIA_STORE], 'readwrite');
        const albumStore = tx.objectStore(ALBUMS_STORE);
        const mediaStore = tx.objectStore(MEDIA_STORE);

        albumStore.clear();
        mediaStore.clear();

        for (const album of data.albums) {
          albumStore.put(album);
        }

        if (Array.isArray(data.media)) {
          for (const item of data.media) {
            mediaStore.put(item);
          }
        }

        tx.oncomplete = () => resolve(true);
        tx.onerror = () => resolve(false);
      });

      localStorage.setItem('prasobh_last_cloud_sync', new Date().toISOString());
      notifySyncListeners({ albums: data.albums, media: data.media || [] });
      return { albums: data.albums, media: data.media || [] };
    }
  } catch (err) {
    console.warn('Cloud pull error (using local cache):', err);
  }
  return null;
}

export async function initializeStorage() {
  try {
    const db = await openDB();
    await new Promise((resolve) => {
      const tx = db.transaction([ALBUMS_STORE, MEDIA_STORE], 'readwrite');
      const albumStore = tx.objectStore(ALBUMS_STORE);

      const req = albumStore.count();
      req.onsuccess = () => {
        if (req.result === 0) {
          for (const album of DEFAULT_ALBUMS) {
            albumStore.put(album);
          }
        }
      };

      tx.oncomplete = () => resolve(true);
      tx.onerror = () => resolve(false);
    });

    // In background, sync from cloud
    syncFromCloud().catch(() => {});
    return true;
  } catch (err) {
    console.error('IndexedDB initialize error:', err);
    return false;
  }
}

async function getLocalAlbums() {
  try {
    const db = await openDB();
    return new Promise((resolve) => {
      const tx = db.transaction(ALBUMS_STORE, 'readonly');
      const store = tx.objectStore(ALBUMS_STORE);
      const req = store.getAll();
      req.onsuccess = () => {
        const list = req.result;
        if (list && list.length > 0) {
          resolve(list);
        } else {
          resolve(DEFAULT_ALBUMS);
        }
      };
      req.onerror = () => resolve(DEFAULT_ALBUMS);
    });
  } catch (err) {
    return DEFAULT_ALBUMS;
  }
}

export async function getAlbums() {
  return getLocalAlbums();
}

export async function saveAlbum(album) {
  const db = await openDB();
  await new Promise((resolve, reject) => {
    const tx = db.transaction(ALBUMS_STORE, 'readwrite');
    const store = tx.objectStore(ALBUMS_STORE);
    const req = store.put(album);
    req.onsuccess = () => resolve(album);
    req.onerror = () => reject(req.error);
  });

  // Automatically sync to cloud
  syncToCloud().catch(console.error);
  return album;
}

export async function updateAlbumCover(albumId, newCoverUrl) {
  const db = await openDB();
  await new Promise((resolve, reject) => {
    const tx = db.transaction(ALBUMS_STORE, 'readwrite');
    const store = tx.objectStore(ALBUMS_STORE);
    const getReq = store.get(albumId);
    getReq.onsuccess = () => {
      const album = getReq.result;
      if (album) {
        album.coverImage = newCoverUrl;
        store.put(album);
      }
    };
    tx.oncomplete = () => resolve(true);
    tx.onerror = () => reject(tx.error);
  });

  // Automatically sync to cloud
  syncToCloud().catch(console.error);
  return true;
}

export async function deleteAlbum(albumId) {
  const db = await openDB();
  await new Promise((resolve, reject) => {
    const tx = db.transaction([ALBUMS_STORE, MEDIA_STORE], 'readwrite');
    const albumStore = tx.objectStore(ALBUMS_STORE);
    const mediaStore = tx.objectStore(MEDIA_STORE);

    albumStore.delete(albumId);

    const mediaReq = mediaStore.getAll();
    mediaReq.onsuccess = () => {
      const items = mediaReq.result || [];
      items.forEach((item) => {
        if (item.albumId === albumId) {
          mediaStore.delete(item.id);
        }
      });
    };

    tx.oncomplete = () => resolve(true);
    tx.onerror = () => reject(tx.error);
  });

  // Automatically sync to cloud
  syncToCloud().catch(console.error);
  return true;
}

async function getLocalMedia() {
  try {
    const db = await openDB();
    return new Promise((resolve) => {
      const tx = db.transaction(MEDIA_STORE, 'readonly');
      const store = tx.objectStore(MEDIA_STORE);
      const req = store.getAll();
      req.onsuccess = () => resolve(req.result || []);
      req.onerror = () => resolve([]);
    });
  } catch (err) {
    return [];
  }
}

export async function getAllMedia() {
  return getLocalMedia();
}

export async function saveMediaItem(mediaItem) {
  const db = await openDB();
  await new Promise((resolve, reject) => {
    const tx = db.transaction(MEDIA_STORE, 'readwrite');
    const store = tx.objectStore(MEDIA_STORE);
    const req = store.put(mediaItem);
    req.onsuccess = () => resolve(mediaItem);
    req.onerror = () => reject(req.error);
  });

  // Automatically sync to cloud
  syncToCloud().catch(console.error);
  return mediaItem;
}

// Batch save multiple media items at once
export async function saveMultipleMediaItems(itemsList) {
  const db = await openDB();
  await new Promise((resolve, reject) => {
    const tx = db.transaction(MEDIA_STORE, 'readwrite');
    const store = tx.objectStore(MEDIA_STORE);
    itemsList.forEach((item) => {
      store.put(item);
    });
    tx.oncomplete = () => resolve(true);
    tx.onerror = () => reject(tx.error);
  });

  // Automatically sync to cloud
  syncToCloud().catch(console.error);
  return true;
}

// Update caption, title, or metadata for an existing media item
export async function updateMediaItem(mediaId, updates) {
  const db = await openDB();
  await new Promise((resolve, reject) => {
    const tx = db.transaction(MEDIA_STORE, 'readwrite');
    const store = tx.objectStore(MEDIA_STORE);
    const getReq = store.get(mediaId);
    getReq.onsuccess = () => {
      const item = getReq.result;
      if (item) {
        const updatedItem = {
          ...item,
          ...updates,
          exif: {
            ...item.exif,
            ...(updates.exif || {})
          }
        };
        store.put(updatedItem);
      }
    };
    tx.oncomplete = () => resolve(true);
    tx.onerror = () => reject(tx.error);
  });

  // Automatically sync to cloud
  syncToCloud().catch(console.error);
  return true;
}

export async function deleteMediaItem(mediaId) {
  const db = await openDB();
  await new Promise((resolve, reject) => {
    const tx = db.transaction(MEDIA_STORE, 'readwrite');
    const store = tx.objectStore(MEDIA_STORE);
    const req = store.delete(mediaId);
    req.onsuccess = () => resolve(true);
    req.onerror = () => reject(req.error);
  });

  // Automatically sync to cloud
  syncToCloud().catch(console.error);
  return true;
}

// Export gallery backup JSON
export async function exportGalleryBackup() {
  const albums = await getLocalAlbums();
  const media = await getLocalMedia();
  const backup = {
    author: 'Prasobh',
    exportedAt: new Date().toISOString(),
    albums,
    media
  };
  return JSON.stringify(backup, null, 2);
}

// Import gallery backup JSON
export async function importGalleryBackup(jsonString) {
  try {
    const parsed = typeof jsonString === 'string' ? JSON.parse(jsonString) : jsonString;
    if (!parsed || (!parsed.albums && !parsed.media)) {
      throw new Error('Invalid gallery data format');
    }

    const db = await openDB();
    const tx = db.transaction([ALBUMS_STORE, MEDIA_STORE], 'readwrite');
    const albumStore = tx.objectStore(ALBUMS_STORE);
    const mediaStore = tx.objectStore(MEDIA_STORE);

    if (parsed.albums && Array.isArray(parsed.albums)) {
      for (const album of parsed.albums) {
        albumStore.put(album);
      }
    }

    if (parsed.media && Array.isArray(parsed.media)) {
      for (const item of parsed.media) {
        mediaStore.put(item);
      }
    }

    await new Promise((resolve) => {
      tx.oncomplete = () => resolve(true);
      tx.onerror = () => resolve(false);
    });

    // Automatically sync imported data to cloud
    await syncToCloud();
    return true;
  } catch (err) {
    console.error('Import failed:', err);
    throw err;
  }
}

export async function resetGalleryToDefaults() {
  const db = await openDB();
  await new Promise((resolve, reject) => {
    const tx = db.transaction([ALBUMS_STORE, MEDIA_STORE], 'readwrite');
    const albumStore = tx.objectStore(ALBUMS_STORE);
    const mediaStore = tx.objectStore(MEDIA_STORE);

    albumStore.clear();
    mediaStore.clear();

    for (const album of DEFAULT_ALBUMS) {
      albumStore.put(album);
    }

    tx.oncomplete = () => resolve(true);
    tx.onerror = () => reject(tx.error);
  });

  // Automatically sync reset state to cloud
  await syncToCloud();
  return true;
}
