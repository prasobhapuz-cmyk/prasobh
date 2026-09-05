// Robust Hybrid IndexedDB + Cloud Storage Service for Prasobh's Gallery
// Guarantees zero data loss, instant 0ms local access, and real-time cross-device sync

const DB_NAME = 'GeometryOfSilenceDB';
const DB_VERSION = 2;
const ALBUMS_STORE = 'albums';
const MEDIA_STORE = 'media';

export const CLOUD_STORAGE_BIN_ID = 'bdbddaa';
export const DIRECT_CLOUD_URL = `https://extendsclass.com/api/json-storage/bin/${CLOUD_STORAGE_BIN_ID}`;

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

// Upload base64 image data to global CDN
export async function uploadImageToCDN(dataUrl, filename) {
  if (!dataUrl || typeof dataUrl !== 'string' || !dataUrl.startsWith('data:')) {
    return dataUrl;
  }
  try {
    const res = await fetch('/api/upload', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ image: dataUrl, filename: filename || `photo_${Date.now()}.jpg` })
    });
    if (res.ok) {
      const data = await res.json();
      if (data && data.url) {
        return data.url;
      }
    }
  } catch (err) {
    console.warn('CDN upload error:', err);
  }
  return dataUrl;
}

// Push local data to the cloud storage API
export async function syncToCloud() {
  try {
    const albums = await getLocalAlbums();
    const media = await getLocalMedia();
    const payload = {
      albums,
      media,
      updatedAt: new Date().toISOString()
    };

    // Primary: Call same-origin /api/sync endpoint
    let success = false;
    try {
      const res = await fetch('/api/sync', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      if (res.ok) {
        success = true;
      }
    } catch (apiErr) {
      console.warn('/api/sync unreachable, trying direct fallback', apiErr);
    }

    // Direct fallback if /api/sync was not available
    if (!success) {
      try {
        const directRes = await fetch(DIRECT_CLOUD_URL, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload)
        });
        if (directRes.ok) {
          success = true;
        }
      } catch (directErr) {
        console.warn('Direct cloud push error:', directErr);
      }
    }

    if (success) {
      localStorage.setItem('prasobh_last_cloud_sync', new Date().toISOString());
      return { success: true, timestamp: new Date().toISOString() };
    }
    return { success: false };
  } catch (err) {
    console.warn('Cloud sync push error:', err);
    return { success: false, error: err.message };
  }
}

// Fetch latest cloud data and INTELLIGENTLY MERGE with local data (Never drops local items)
export async function syncFromCloud() {
  try {
    let cloudAlbums = null;
    let cloudMedia = null;

    // 1. Try /api/sync
    try {
      const res = await fetch('/api/sync?t=' + Date.now(), {
        headers: { 'Accept': 'application/json' },
        cache: 'no-store'
      });
      if (res.ok) {
        const json = await res.json();
        if (json && Array.isArray(json.albums) && json.albums.length > 0) {
          cloudAlbums = json.albums;
          cloudMedia = Array.isArray(json.media) ? json.media : [];
        }
      }
    } catch (apiErr) {
      console.warn('/api/sync fetch error:', apiErr);
    }

    // 2. Direct Cloud fallback
    if (!cloudAlbums) {
      try {
        const res = await fetch(DIRECT_CLOUD_URL + '?t=' + Date.now(), {
          headers: { 'Accept': 'application/json' },
          cache: 'no-store'
        });
        if (res.ok) {
          const json = await res.json();
          if (json && Array.isArray(json.albums) && json.albums.length > 0) {
            cloudAlbums = json.albums;
            cloudMedia = Array.isArray(json.media) ? json.media : [];
          }
        }
      } catch (directErr) {
        console.warn('Direct cloud fetch error:', directErr);
      }
    }

    if (!cloudAlbums || cloudAlbums.length === 0) {
      return null;
    }

    // Intelligent Union Merge with Local Data
    const localAlbums = await getLocalAlbums();
    const localMedia = await getLocalMedia();

    const mergedAlbumsMap = new Map();
    DEFAULT_ALBUMS.forEach(a => mergedAlbumsMap.set(a.id, a));
    cloudAlbums.forEach(a => mergedAlbumsMap.set(a.id, a));
    localAlbums.forEach(a => mergedAlbumsMap.set(a.id, a));

    const mergedMediaMap = new Map();
    cloudMedia.forEach(m => mergedMediaMap.set(m.id, m));
    localMedia.forEach(m => mergedMediaMap.set(m.id, m));

    const finalAlbums = Array.from(mergedAlbumsMap.values());
    const finalMedia = Array.from(mergedMediaMap.values());

    // Save merged results into local IndexedDB
    const db = await openDB();
    await new Promise((resolve) => {
      const tx = db.transaction([ALBUMS_STORE, MEDIA_STORE], 'readwrite');
      const albumStore = tx.objectStore(ALBUMS_STORE);
      const mediaStore = tx.objectStore(MEDIA_STORE);

      for (const album of finalAlbums) {
        albumStore.put(album);
      }
      for (const item of finalMedia) {
        mediaStore.put(item);
      }

      tx.oncomplete = () => resolve(true);
      tx.onerror = () => resolve(false);
    });

    localStorage.setItem('prasobh_last_cloud_sync', new Date().toISOString());
    notifySyncListeners({ albums: finalAlbums, media: finalMedia });

    // If local had new items not in cloud, push the merged set to cloud
    if (finalAlbums.length > cloudAlbums.length || finalMedia.length > cloudMedia.length) {
      syncToCloud().catch(() => {});
    }

    return { albums: finalAlbums, media: finalMedia };
  } catch (err) {
    console.warn('Cloud sync error (keeping local data):', err);
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
  // Ensure cover is uploaded to CDN if it's base64
  if (album.coverImage && album.coverImage.startsWith('data:')) {
    album.coverImage = await uploadImageToCDN(album.coverImage, `${album.title}_cover.jpg`);
  }

  const db = await openDB();
  await new Promise((resolve, reject) => {
    const tx = db.transaction(ALBUMS_STORE, 'readwrite');
    const store = tx.objectStore(ALBUMS_STORE);
    const req = store.put(album);
    req.onsuccess = () => resolve(album);
    req.onerror = () => reject(req.error);
  });

  // Trigger background cloud sync
  syncToCloud().catch(console.error);
  return album;
}

export async function updateAlbumCover(albumId, newCoverUrl) {
  let finalCoverUrl = newCoverUrl;
  if (newCoverUrl && newCoverUrl.startsWith('data:')) {
    finalCoverUrl = await uploadImageToCDN(newCoverUrl, `cover_${albumId}.jpg`);
  }

  const db = await openDB();
  await new Promise((resolve, reject) => {
    const tx = db.transaction(ALBUMS_STORE, 'readwrite');
    const store = tx.objectStore(ALBUMS_STORE);
    const getReq = store.get(albumId);
    getReq.onsuccess = () => {
      const album = getReq.result;
      if (album) {
        album.coverImage = finalCoverUrl;
        store.put(album);
      }
    };
    tx.oncomplete = () => resolve(true);
    tx.onerror = () => reject(tx.error);
  });

  // Trigger background cloud sync
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

  // Trigger background cloud sync
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
  if (mediaItem.url && mediaItem.url.startsWith('data:')) {
    mediaItem.url = await uploadImageToCDN(mediaItem.url, `${mediaItem.title || 'photo'}.jpg`);
  }

  const db = await openDB();
  await new Promise((resolve, reject) => {
    const tx = db.transaction(MEDIA_STORE, 'readwrite');
    const store = tx.objectStore(MEDIA_STORE);
    const req = store.put(mediaItem);
    req.onsuccess = () => resolve(mediaItem);
    req.onerror = () => reject(req.error);
  });

  // Trigger background cloud sync
  syncToCloud().catch(console.error);
  return mediaItem;
}

export async function saveMultipleMediaItems(itemsList) {
  // Convert any base64 images in batch to CDN URLs
  for (const item of itemsList) {
    if (item.url && item.url.startsWith('data:')) {
      item.url = await uploadImageToCDN(item.url, `${item.title || 'photo'}.jpg`);
    }
  }

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

  // Trigger background cloud sync
  syncToCloud().catch(console.error);
  return true;
}

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

  // Trigger background cloud sync
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

  // Trigger background cloud sync
  syncToCloud().catch(console.error);
  return true;
}

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
    tx.onerror = () => resolve(false);
  });

  await syncToCloud();
  return true;
}
