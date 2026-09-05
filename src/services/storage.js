// IndexedDB Storage Service for Prasobh's Gallery with Cross-Device Sync Support

const DB_NAME = 'GeometryOfSilenceDB';
const DB_VERSION = 2;
const ALBUMS_STORE = 'albums';
const MEDIA_STORE = 'media';

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

// Initialize storage: check IndexedDB and sync with public gallery_manifest.json
export async function initializeStorage() {
  const db = await openDB();
  
  // 1. Check local database
  const localAlbums = await getAlbums();
  
  // 2. Fetch manifest if available
  let manifest = null;
  try {
    const res = await fetch('/gallery_manifest.json', { cache: 'no-cache' });
    if (res.ok) {
      manifest = await res.json();
    }
  } catch (err) {
    console.log('Manifest not reachable, using local database.');
  }

  const tx = db.transaction([ALBUMS_STORE, MEDIA_STORE], 'readwrite');
  const albumStore = tx.objectStore(ALBUMS_STORE);
  const mediaStore = tx.objectStore(MEDIA_STORE);

  // If local database is empty, seed with manifest or default albums
  if (localAlbums.length === 0) {
    const seedAlbums = (manifest && manifest.albums && manifest.albums.length > 0)
      ? manifest.albums
      : DEFAULT_ALBUMS;

    for (const album of seedAlbums) {
      albumStore.put(album);
    }

    if (manifest && manifest.media && manifest.media.length > 0) {
      for (const item of manifest.media) {
        mediaStore.put(item);
      }
    }
  } else if (manifest && manifest.albums) {
    // Merge any new manifest albums that don't exist locally yet
    const existingIds = new Set(localAlbums.map((a) => a.id));
    for (const album of manifest.albums) {
      if (!existingIds.has(album.id)) {
        albumStore.put(album);
      }
    }
    if (manifest.media) {
      const localMedia = await getAllMedia();
      const existingMediaIds = new Set(localMedia.map((m) => m.id));
      for (const item of manifest.media) {
        if (!existingMediaIds.has(item.id)) {
          mediaStore.put(item);
        }
      }
    }
  }

  return new Promise((resolve) => {
    tx.oncomplete = () => resolve(true);
    tx.onerror = () => resolve(false);
  });
}

export async function getAlbums() {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(ALBUMS_STORE, 'readonly');
    const store = tx.objectStore(ALBUMS_STORE);
    const req = store.getAll();
    req.onsuccess = () => resolve(req.result || []);
    req.onerror = () => reject(req.error);
  });
}

export async function saveAlbum(album) {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(ALBUMS_STORE, 'readwrite');
    const store = tx.objectStore(ALBUMS_STORE);
    const req = store.put(album);
    req.onsuccess = () => resolve(album);
    req.onerror = () => reject(req.error);
  });
}

export async function updateAlbumCover(albumId, newCoverUrl) {
  const db = await openDB();
  return new Promise((resolve, reject) => {
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
}

export async function deleteAlbum(albumId) {
  const db = await openDB();
  return new Promise((resolve, reject) => {
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
}

export async function getAllMedia() {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(MEDIA_STORE, 'readonly');
    const store = tx.objectStore(MEDIA_STORE);
    const req = store.getAll();
    req.onsuccess = () => resolve(req.result || []);
    req.onerror = () => reject(req.error);
  });
}

export async function saveMediaItem(mediaItem) {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(MEDIA_STORE, 'readwrite');
    const store = tx.objectStore(MEDIA_STORE);
    const req = store.put(mediaItem);
    req.onsuccess = () => resolve(mediaItem);
    req.onerror = () => reject(req.error);
  });
}

// Batch save multiple media items at once
export async function saveMultipleMediaItems(itemsList) {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(MEDIA_STORE, 'readwrite');
    const store = tx.objectStore(MEDIA_STORE);
    itemsList.forEach((item) => {
      store.put(item);
    });
    tx.oncomplete = () => resolve(true);
    tx.onerror = () => reject(tx.error);
  });
}

// Update caption, title, or metadata for an existing media item
export async function updateMediaItem(mediaId, updates) {
  const db = await openDB();
  return new Promise((resolve, reject) => {
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
}

export async function deleteMediaItem(mediaId) {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(MEDIA_STORE, 'readwrite');
    const store = tx.objectStore(MEDIA_STORE);
    const req = store.delete(mediaId);
    req.onsuccess = () => resolve(true);
    req.onerror = () => reject(req.error);
  });
}

// Export gallery backup JSON
export async function exportGalleryBackup() {
  const albums = await getAlbums();
  const media = await getAllMedia();
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

    return new Promise((resolve) => {
      tx.oncomplete = () => resolve(true);
      tx.onerror = () => resolve(false);
    });
  } catch (err) {
    console.error('Import failed:', err);
    throw err;
  }
}

export async function resetGalleryToDefaults() {
  const db = await openDB();
  return new Promise((resolve, reject) => {
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
}
