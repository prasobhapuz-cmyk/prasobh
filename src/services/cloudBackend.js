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

// 1. Upload raw image/video file to Cloud Storage Bucket
export async function uploadAssetToCloud(fileOrDataUrl, filename = 'asset.jpg') {
  if (!fileOrDataUrl) return '';

  // If already a remote HTTPS URL or image stream URL, return as is
  if (typeof fileOrDataUrl === 'string' && !fileOrDataUrl.startsWith('data:')) {
    return fileOrDataUrl;
  }

  // Supabase Storage Upload (if enabled)
  if (CLOUD_CONFIG.supabase?.enabled && CLOUD_CONFIG.supabase.url && CLOUD_CONFIG.supabase.anonKey) {
    try {
      const cleanName = `${Date.now()}-${filename.replace(/[^a-zA-Z0-9.-]/g, '_')}`;
      const uploadUrl = `${CLOUD_CONFIG.supabase.url}/storage/v1/object/${CLOUD_CONFIG.supabase.storageBucket}/${cleanName}`;

      let bodyData;
      if (typeof fileOrDataUrl === 'string') {
        const base64 = fileOrDataUrl.replace(/^data:image\/\w+;base64,/, '');
        bodyData = Uint8Array.from(atob(base64), c => c.charCodeAt(0));
      } else {
        bodyData = fileOrDataUrl;
      }

      const res = await fetch(uploadUrl, {
        method: 'POST',
        headers: {
          'apikey': CLOUD_CONFIG.supabase.anonKey,
          'Authorization': `Bearer ${CLOUD_CONFIG.supabase.anonKey}`,
          'Content-Type': 'image/jpeg'
        },
        body: bodyData
      });

      if (res.ok) {
        return `${CLOUD_CONFIG.supabase.url}/storage/v1/object/public/${CLOUD_CONFIG.supabase.storageBucket}/${cleanName}`;
      }
    } catch (sbErr) {
      console.warn('Supabase storage upload error:', sbErr);
    }
  }

  // Firebase Storage Upload (if enabled)
  if (CLOUD_CONFIG.firebase?.enabled && CLOUD_CONFIG.firebase.storageBucket) {
    try {
      const cleanName = encodeURIComponent(`${Date.now()}_${filename}`);
      const uploadUrl = `https://firebasestorage.googleapis.com/v0/b/${CLOUD_CONFIG.firebase.storageBucket}/o?name=${cleanName}`;

      let bodyData;
      if (typeof fileOrDataUrl === 'string') {
        const base64 = fileOrDataUrl.replace(/^data:image\/\w+;base64,/, '');
        bodyData = Uint8Array.from(atob(base64), c => c.charCodeAt(0));
      } else {
        bodyData = fileOrDataUrl;
      }

      const res = await fetch(uploadUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'image/jpeg' },
        body: bodyData
      });

      if (res.ok) {
        const json = await res.json();
        return `https://firebasestorage.googleapis.com/v0/b/${CLOUD_CONFIG.firebase.storageBucket}/o/${cleanName}?alt=media&token=${json.downloadTokens}`;
      }
    } catch (fbErr) {
      console.warn('Firebase storage upload error:', fbErr);
    }
  }

  // Built-in Serverless Cloud Storage Uploader (Active Default)
  try {
    let dataUrlToSend = fileOrDataUrl;
    if (typeof fileOrDataUrl !== 'string' && typeof FileReader !== 'undefined') {
      dataUrlToSend = await new Promise((resolve) => {
        const reader = new FileReader();
        reader.onload = (e) => resolve(e.target?.result || '');
        reader.onerror = () => resolve('');
        reader.readAsDataURL(fileOrDataUrl);
      });
    }

    if (typeof window !== 'undefined') {
      const res = await fetch('/api/upload', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ image: dataUrlToSend, filename })
      });

      if (res.ok) {
        const data = await res.json();
        if (data && data.url) {
          return data.url;
        }
      }
    }
  } catch (err) {
    console.warn('Serverless uploader error:', err);
  }

  // Return user's actual image data
  return fileOrDataUrl;
}

// 2. Fetch full gallery data from Centralized Cloud Database
export async function fetchCloudGalleryData() {
  try {
    // Supabase Database Query
    if (CLOUD_CONFIG.supabase?.enabled && CLOUD_CONFIG.supabase.url && CLOUD_CONFIG.supabase.anonKey) {
      try {
        const albumsRes = await fetch(`${CLOUD_CONFIG.supabase.url}/rest/v1/${CLOUD_CONFIG.supabase.albumsTable}?select=*`, {
          headers: {
            'apikey': CLOUD_CONFIG.supabase.anonKey,
            'Authorization': `Bearer ${CLOUD_CONFIG.supabase.anonKey}`
          }
        });
        const mediaRes = await fetch(`${CLOUD_CONFIG.supabase.url}/rest/v1/${CLOUD_CONFIG.supabase.mediaTable}?select=*`, {
          headers: {
            'apikey': CLOUD_CONFIG.supabase.anonKey,
            'Authorization': `Bearer ${CLOUD_CONFIG.supabase.anonKey}`
          }
        });

        if (albumsRes.ok) {
          const rawAlbums = await albumsRes.json();
          const rawMedia = mediaRes.ok ? await mediaRes.json() : [];
          if (Array.isArray(rawAlbums) && rawAlbums.length > 0) {
            const normalizedAlbums = rawAlbums.map(a => ({
              ...a,
              id: a.folderId || a.id,
              folderId: a.folderId || a.id,
              title: a.folderName || a.title,
              folderName: a.folderName || a.title,
              userId: a.userId || 'user_prasobh_appus07',
              createdAt: a.createdAt || new Date().toISOString()
            }));
            const normalizedMedia = rawMedia.map(m => ({
              ...m,
              id: m.mediaId || m.id,
              albumId: m.folderId || m.albumId,
              folderId: m.folderId || m.albumId,
              userId: m.userId || 'user_prasobh_appus07'
            }));
            notifySubscribers({ albums: normalizedAlbums, media: normalizedMedia });
            return { albums: normalizedAlbums, media: normalizedMedia };
          }
        }
      } catch (sbErr) {
        console.warn('Supabase fetch error:', sbErr);
      }
    }

    // Built-in Serverless Cloud Database Query
    const endpoint = typeof window !== 'undefined' 
      ? `/api/sync?t=${Date.now()}` 
      : `https://extendsclass.com/api/json-storage/bin/bdbddaa?t=${Date.now()}`;

    const res = await fetch(endpoint, {
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
          albumId: m.folderId || m.albumId,
          folderId: m.folderId || m.albumId,
          userId: m.userId || 'user_prasobh_appus07'
        }));
        const result = { albums: normalizedAlbums, media: normalizedMedia };
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
  const normalizedAlbums = albums.map(a => ({
    ...a,
    id: a.folderId || a.id,
    folderId: a.folderId || a.id,
    title: a.folderName || a.title,
    folderName: a.folderName || a.title,
    userId: a.userId || 'user_prasobh_appus07',
    createdAt: a.createdAt || new Date().toISOString()
  }));

  const normalizedMedia = media.map(m => ({
    ...m,
    id: m.mediaId || m.id,
    albumId: m.folderId || m.albumId,
    folderId: m.folderId || m.albumId,
    userId: m.userId || 'user_prasobh_appus07'
  }));

  const payload = {
    albums: normalizedAlbums,
    media: normalizedMedia,
    updatedAt: new Date().toISOString()
  };

  // Immediate in-memory notification for instant 0ms UI update
  notifySubscribers({ albums: normalizedAlbums, media: normalizedMedia });

  // Supabase Push (if enabled)
  if (CLOUD_CONFIG.supabase?.enabled && CLOUD_CONFIG.supabase.url && CLOUD_CONFIG.supabase.anonKey) {
    try {
      await fetch(`${CLOUD_CONFIG.supabase.url}/rest/v1/${CLOUD_CONFIG.supabase.albumsTable}`, {
        method: 'POST',
        headers: {
          'apikey': CLOUD_CONFIG.supabase.anonKey,
          'Authorization': `Bearer ${CLOUD_CONFIG.supabase.anonKey}`,
          'Content-Type': 'application/json',
          'Prefer': 'resolution=merge-duplicates'
        },
        body: JSON.stringify(normalizedAlbums)
      });
    } catch (sbErr) {
      console.warn('Supabase push error:', sbErr);
    }
  }

  // Built-in Serverless Cloud Endpoint
  const endpoint = typeof window !== 'undefined'
    ? '/api/sync'
    : 'https://extendsclass.com/api/json-storage/bin/bdbddaa';

  const method = typeof window !== 'undefined' ? 'POST' : 'PUT';

  try {
    const res = await fetch(endpoint, {
      method,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });

    if (res.ok) {
      const data = await res.json();
      return { success: true, albums: data.albums || normalizedAlbums, media: data.media || normalizedMedia };
    }
  } catch (err) {
    console.error('Push to cloud error:', err);
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

// 7. Batch Upload and Save Media Items to Cloud Storage & Database
export async function saveCloudMediaItems(itemsList, onProgress) {
  const current = await fetchCloudGalleryData();
  const processedItems = [];

  for (let i = 0; i < itemsList.length; i++) {
    const item = itemsList[i];
    if (onProgress) {
      onProgress(i + 1, itemsList.length, item.title || item.name || `Photo ${i + 1}`);
    }

    let finalMediaUrl = item.url;
    if (finalMediaUrl && finalMediaUrl.startsWith('data:')) {
      finalMediaUrl = await uploadAssetToCloud(finalMediaUrl, `${item.title || 'photo'}_${Date.now()}.jpg`);
    }

    const targetFolderId = item.folderId || item.albumId || current.albums[0]?.id || 'folder-kyoto';

    processedItems.push({
      ...item,
      id: item.mediaId || item.id || `media-${Date.now()}-${i}`,
      mediaId: item.mediaId || item.id || `media-${Date.now()}-${i}`,
      albumId: targetFolderId,
      folderId: targetFolderId,
      userId: item.userId || 'user_prasobh_appus07',
      type: item.type || 'photo',
      title: item.title || `Photo ${i + 1}`,
      location: item.location || '',
      url: finalMediaUrl,
      aspectRatio: item.aspectRatio || 'landscape',
      createdAt: item.createdAt || new Date().toISOString(),
      caption: item.caption || '',
      exif: item.exif || { camera: '' }
    });
  }

  const existingMedia = current.media || [];
  const updatedMedia = [...existingMedia.filter(m => !processedItems.some(p => p.id === m.id)), ...processedItems];

  await pushCloudGalleryData(current.albums || [], updatedMedia);
  return processedItems;
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
