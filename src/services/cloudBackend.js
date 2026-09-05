// Centralized Cloud Backend Service for Prasobh's Gallery
// Handles raw asset cloud storage uploads, database CRUD operations, and cross-device sync
// Supports Supabase, Firebase Firestore, and Built-in Serverless Cloud Backend

import { CLOUD_CONFIG } from '../config/cloudConfig.js';

export const DEFAULT_ALBUMS = [
  {
    id: 'folder-kyoto',
    folderId: 'folder-kyoto',
    title: 'Kyoto',
    folderName: 'Kyoto',
    userId: 'user_prasobh_appus07',
    createdAt: '2026-09-01T00:00:00.000Z',
    location: 'Japan',
    coverImage: 'https://images.unsplash.com/photo-1493976040374-85c8e12f0c0e?q=80&w=1200&auto=format&fit=crop',
    description: 'Silence in stone, bamboo groves, and ancient wooden shrines.'
  },
  {
    id: 'folder-iceland',
    folderId: 'folder-iceland',
    title: 'Iceland',
    folderName: 'Iceland',
    userId: 'user_prasobh_appus07',
    createdAt: '2026-09-02T00:00:00.000Z',
    location: 'Nordic Coast',
    coverImage: 'https://images.unsplash.com/photo-1504893524553-b855bce32c67?q=80&w=1200&auto=format&fit=crop',
    description: 'Basalt shores, glacial stillness, and volcanic horizons.'
  },
  {
    id: 'folder-amalfi',
    folderId: 'folder-amalfi',
    title: 'Amalfi',
    folderName: 'Amalfi',
    userId: 'user_prasobh_appus07',
    createdAt: '2026-09-03T00:00:00.000Z',
    location: 'Italy',
    coverImage: 'https://images.unsplash.com/photo-1533105079780-92b9be482077?q=80&w=1200&auto=format&fit=crop',
    description: 'Cliffs meeting the sea under pure Mediterranean light.'
  }
];

export const DEFAULT_MEDIA = [];

// Broadcast listeners for real-time UI updates
const listeners = new Set();
let inMemoryData = { albums: DEFAULT_ALBUMS, media: [] };

export function subscribeToCloudUpdates(callback) {
  listeners.add(callback);
  return () => listeners.delete(callback);
}

function notifySubscribers(data) {
  inMemoryData = data;
  listeners.forEach((cb) => {
    try {
      cb(data);
    } catch (e) {
      console.error('Subscriber notification error:', e);
    }
  });
}

// 1. Upload raw image asset to Cloud Storage and return permanent stream URL (/api/image?id=...)
export async function uploadAssetToCloud(fileOrDataUrl, filename = 'photo.jpg') {
  if (!fileOrDataUrl) return '';

  // If already a remote HTTPS URL or image stream URL, return as is
  if (typeof fileOrDataUrl === 'string' && !fileOrDataUrl.startsWith('data:')) {
    return fileOrDataUrl;
  }

  // Convert File / Blob to Data URL if needed
  let dataUrlToSend = fileOrDataUrl;
  if (typeof fileOrDataUrl !== 'string' && typeof FileReader !== 'undefined') {
    dataUrlToSend = await new Promise((resolve) => {
      const reader = new FileReader();
      reader.onload = (e) => resolve(e.target?.result || '');
      reader.onerror = () => resolve('');
      reader.readAsDataURL(fileOrDataUrl);
    });
  }

  if (!dataUrlToSend || typeof dataUrlToSend !== 'string' || !dataUrlToSend.startsWith('data:')) {
    return fileOrDataUrl;
  }

  // Serverless upload endpoint (/api/upload) with retry & exponential backoff
  if (typeof window !== 'undefined') {
    for (let attempt = 0; attempt < 2; attempt++) {
      try {
        const res = await fetch('/api/upload', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ image: dataUrlToSend, filename })
        });

        if (res.ok) {
          const data = await res.json();
          if (data && data.url && !data.url.startsWith('data:')) {
            return data.url;
          }
        }
      } catch (apiErr) {
        if (attempt === 0) {
          await new Promise(r => setTimeout(r, 250));
        }
      }
    }
  }

  return dataUrlToSend;
}

// 2. Fetch full gallery data from Centralized Cloud Database
export async function fetchCloudGalleryData() {
  try {
    // Strategy A: Try serverless /api/sync endpoint
    if (typeof window !== 'undefined') {
      try {
        const res = await fetch(`/api/sync?t=${Date.now()}`, {
          headers: { 'Accept': 'application/json' },
          cache: 'no-store'
        });

        if (res.ok) {
          const data = await res.json();
          if (data && Array.isArray(data.albums) && data.albums.length > 0) {
            const normalizedAlbums = data.albums.map(a => ({
              ...a,
              id: a.folderId || a.id,
              folderId: a.folderId || a.id,
              title: a.folderName || a.title,
              folderName: a.folderName || a.title,
              userId: a.userId || 'user_prasobh_appus07',
              createdAt: a.createdAt || new Date().toISOString()
            }));
            const normalizedMedia = (data.media || []).map(m => ({
              ...m,
              id: m.mediaId || m.id,
              mediaId: m.mediaId || m.id,
              albumId: m.folderId || m.albumId,
              folderId: m.folderId || m.albumId,
              userId: m.userId || 'user_prasobh_appus07'
            }));
            const result = { albums: normalizedAlbums, media: normalizedMedia };
            inMemoryData = result;
            notifySubscribers(result);
            return result;
          }
        }
      } catch (apiErr) {}
    }

    // Strategy B: Direct fetch from central cloud bin
    const res = await fetch(`https://extendsclass.com/api/json-storage/bin/bdbddaa?t=${Date.now()}`, {
      headers: { 'Accept': 'application/json' },
      cache: 'no-store'
    });

    if (res.ok) {
      const data = await res.json();
      if (data && Array.isArray(data.albums) && data.albums.length > 0) {
        const normalizedAlbums = data.albums.map(a => ({
          ...a,
          id: a.folderId || a.id,
          folderId: a.folderId || a.id,
          title: a.folderName || a.title,
          folderName: a.folderName || a.title,
          userId: a.userId || 'user_prasobh_appus07',
          createdAt: a.createdAt || new Date().toISOString()
        }));
        const normalizedMedia = (data.media || []).map(m => ({
          ...m,
          id: m.mediaId || m.id,
          mediaId: m.mediaId || m.id,
          albumId: m.folderId || m.albumId,
          folderId: m.folderId || m.albumId,
          userId: m.userId || 'user_prasobh_appus07'
        }));
        const result = { albums: normalizedAlbums, media: normalizedMedia };
        inMemoryData = result;
        notifySubscribers(result);
        return result;
      }
    }
  } catch (err) {
    console.warn('Cloud fetch error:', err);
  }

  return inMemoryData || { albums: DEFAULT_ALBUMS, media: [] };
}

// 3. Push full updated gallery data to Centralized Cloud Database
export async function pushCloudGalleryData(albums, media) {
  const normalizedAlbums = (albums || []).map(a => ({
    ...a,
    id: a.folderId || a.id,
    folderId: a.folderId || a.id,
    title: a.folderName || a.title,
    folderName: a.folderName || a.title,
    userId: a.userId || 'user_prasobh_appus07',
    createdAt: a.createdAt || new Date().toISOString()
  }));

  const normalizedMedia = (media || []).map(m => ({
    ...m,
    id: m.mediaId || m.id,
    mediaId: m.mediaId || m.id,
    albumId: m.folderId || m.albumId,
    folderId: m.folderId || m.albumId,
    userId: m.userId || 'user_prasobh_appus07',
    createdAt: m.createdAt || new Date().toISOString()
  }));

  const payload = {
    albums: normalizedAlbums,
    media: normalizedMedia,
    updatedAt: new Date().toISOString()
  };

  // Immediate in-memory notification for instant 0ms UI update
  inMemoryData = { albums: normalizedAlbums, media: normalizedMedia };
  notifySubscribers({ albums: normalizedAlbums, media: normalizedMedia });

  // Strategy A: Serverless /api/sync endpoint
  if (typeof window !== 'undefined') {
    try {
      const res = await fetch('/api/sync', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });

      if (res.ok) {
        const data = await res.json();
        return { success: true, albums: data.albums || normalizedAlbums, media: data.media || normalizedMedia };
      }
    } catch (apiSyncErr) {
      console.warn('API /api/sync error, falling back to direct cloud PUT:', apiSyncErr);
    }
  }

  // Strategy B: Direct cloud database PUT to ExtendsClass bin
  try {
    const res = await fetch('https://extendsclass.com/api/json-storage/bin/bdbddaa', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });

    if (res.ok) {
      const data = await res.json();
      return { success: true, albums: normalizedAlbums, media: normalizedMedia };
    }
  } catch (directPutErr) {
    console.error('Direct cloud database PUT error:', directPutErr);
  }

  return { success: false, albums: normalizedAlbums, media: normalizedMedia };
}

// 4. Create a new album in Cloud Database with required schema
export async function createCloudAlbum(albumData) {
  const folderName = (albumData.folderName || albumData.title || 'Untitled Folder').trim();
  const slug = folderName.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '') || 'folder';
  const folderId = albumData.folderId || albumData.id || `folder-${slug}-${Date.now()}`;
  const userId = albumData.userId || 'user_prasobh_appus07';
  const createdAt = albumData.createdAt || new Date().toISOString();

  let coverUrl = albumData.coverImage;
  if (coverUrl && coverUrl.startsWith('data:')) {
    coverUrl = await uploadAssetToCloud(coverUrl, `${slug}_cover.jpg`);
  }

  if (!coverUrl || (typeof coverUrl === 'string' && coverUrl.trim() === '')) {
    coverUrl = 'https://images.unsplash.com/photo-1493976040374-85c8e12f0c0e?q=80&w=1200&auto=format&fit=crop';
  }

  const newAlbum = {
    id: folderId,
    folderId: folderId,
    title: folderName,
    folderName: folderName,
    userId: userId,
    createdAt: createdAt,
    location: (albumData.location || 'Expedition').trim(),
    description: (albumData.description || '').trim(),
    coverImage: coverUrl
  };

  const current = await fetchCloudGalleryData();
  const existingAlbums = (current.albums && current.albums.length > 0) ? current.albums : DEFAULT_ALBUMS;
  const updatedAlbums = [...existingAlbums.filter(a => a.id !== folderId && a.folderId !== folderId), newAlbum];

  // Instantly notify subscribers for 0ms optimistic UI rendering!
  notifySubscribers({ albums: updatedAlbums, media: current.media || [] });

  await pushCloudGalleryData(updatedAlbums, current.media || []);
  return newAlbum;
}

// 5. Update Album Cover in Cloud Database
export async function updateCloudAlbumCover(albumId, newCoverDataUrl) {
  let finalCoverUrl = newCoverDataUrl;
  if (newCoverDataUrl && newCoverDataUrl.startsWith('data:')) {
    finalCoverUrl = await uploadAssetToCloud(newCoverDataUrl, `cover_${albumId}.jpg`);
  }

  const current = await fetchCloudGalleryData();
  const updatedAlbums = (current.albums || []).map(alb => {
    if (alb.id === albumId || alb.folderId === albumId) {
      return { ...alb, coverImage: finalCoverUrl };
    }
    return alb;
  });

  await pushCloudGalleryData(updatedAlbums, current.media || []);
  return true;
}

// 6. Delete Album and its media from Cloud Database
export async function deleteCloudAlbum(albumId) {
  const current = await fetchCloudGalleryData();
  const updatedAlbums = (current.albums || []).filter(alb => alb.id !== albumId && alb.folderId !== albumId);
  const updatedMedia = (current.media || []).filter(item => item.albumId !== albumId && item.folderId !== albumId);

  await pushCloudGalleryData(updatedAlbums, updatedMedia);
  return true;
}

// 7. High-Speed Batch Upload and Save Media Items to Cloud Storage & Database
export async function saveCloudMediaItems(itemsList, onProgress) {
  if (!itemsList || itemsList.length === 0) return [];
  const current = await fetchCloudGalleryData();
  const totalCount = itemsList.length;
  let completedCount = 0;

  // Process items in paced parallel workers (concurrency of 2)
  const concurrency = 2;
  const processedItems = new Array(totalCount);

  // Worker pool for paced concurrent uploads
  const queue = itemsList.map((item, index) => ({ item, index }));
  
  const worker = async () => {
    while (queue.length > 0) {
      const { item, index } = queue.shift();
      const currentTitle = item.title || item.name || `Photo ${index + 1}`;
      
      if (onProgress) {
        onProgress(completedCount, totalCount, currentTitle);
      }

      let finalMediaUrl = item.url;
      if (finalMediaUrl && finalMediaUrl.startsWith('data:')) {
        try {
          finalMediaUrl = await uploadAssetToCloud(finalMediaUrl, `${item.title || 'photo'}_${Date.now()}_${index}.jpg`);
        } catch (uploadErr) {
          console.warn(`Upload error on item ${index}:`, uploadErr);
        }
      }

      const targetFolderId = item.folderId || item.albumId || current.albums[0]?.id || 'folder-kyoto';

      processedItems[index] = {
        ...item,
        id: item.mediaId || item.id || `media-${Date.now()}-${index}-${Math.random().toString(36).substring(2, 6)}`,
        mediaId: item.mediaId || item.id || `media-${Date.now()}-${index}-${Math.random().toString(36).substring(2, 6)}`,
        albumId: targetFolderId,
        folderId: targetFolderId,
        userId: item.userId || 'user_prasobh_appus07',
        type: item.type || 'photo',
        title: item.title || `Photo ${index + 1}`,
        location: item.location || '',
        url: finalMediaUrl,
        aspectRatio: item.aspectRatio || 'landscape',
        createdAt: item.createdAt || new Date().toISOString(),
        caption: item.caption || '',
        exif: item.exif || { camera: item.camera || '' }
      };

      completedCount++;
      if (onProgress) {
        onProgress(completedCount, totalCount, currentTitle);
      }

      // Small pacing delay to avoid SSL connection saturation
      await new Promise(r => setTimeout(r, 60));
    }
  };

  const pool = [];
  const activeWorkers = Math.min(concurrency, totalCount);
  for (let w = 0; w < activeWorkers; w++) {
    pool.push(worker());
  }
  await Promise.all(pool);

  const validProcessed = processedItems.filter(Boolean);
  const existingMedia = current.media || [];
  const updatedMedia = [...existingMedia.filter(m => !validProcessed.some(p => p.id === m.id)), ...validProcessed];

  // Optimistic subscriber notification for immediate UI rendering
  notifySubscribers({ albums: current.albums || [], media: updatedMedia });

  await pushCloudGalleryData(current.albums || [], updatedMedia);
  return validProcessed;
}

// 8. Update Media Item metadata (caption, title, camera) in Cloud Database
export async function updateCloudMediaItem(mediaId, updates) {
  const current = await fetchCloudGalleryData();
  const updatedMedia = (current.media || []).map(item => {
    if (item.id === mediaId || item.mediaId === mediaId) {
      const targetFolderId = updates.folderId || updates.albumId || item.albumId;
      return {
        ...item,
        ...updates,
        albumId: targetFolderId,
        folderId: targetFolderId,
        exif: {
          ...item.exif,
          ...(updates.exif || {})
        }
      };
    }
    return item;
  });

  await pushCloudGalleryData(current.albums || [], updatedMedia);
  return true;
}

// 9. Delete Media Item from Cloud Database
export async function deleteCloudMediaItem(mediaId) {
  const current = await fetchCloudGalleryData();
  const updatedMedia = (current.media || []).filter(item => item.id !== mediaId && item.mediaId !== mediaId);
  await pushCloudGalleryData(current.albums || [], updatedMedia);
  return true;
}

// 10. Reset Cloud Database to Starter Default Albums
export async function resetCloudToDefaults() {
  await pushCloudGalleryData(DEFAULT_ALBUMS, []);
  return true;
}
