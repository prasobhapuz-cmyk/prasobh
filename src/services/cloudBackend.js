// Centralized Cloud Backend Service for Prasobh's Gallery
// Handles raw asset cloud storage uploads, database CRUD operations, and cross-device sync

import { CLOUD_CONFIG } from '../config/cloudConfig.js';

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

// Broadcast listeners for real-time updates
const listeners = new Set();
let inMemoryData = null;

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

  // If already a remote HTTPS URL, return as is
  if (typeof fileOrDataUrl === 'string' && !fileOrDataUrl.startsWith('data:')) {
    return fileOrDataUrl;
  }

  // Supabase Storage Upload (if configured)
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
      console.warn('Supabase upload fallback:', sbErr);
    }
  }

  // Built-in Serverless Cloud Storage Uploader (Active Default)
  try {
    let dataUrlToSend = fileOrDataUrl;
    if (typeof fileOrDataUrl !== 'string' && typeof FileReader !== 'undefined') {
      dataUrlToSend = await new Promise((resolve) => {
        const reader = new FileReader();
        reader.onload = (e) => resolve(e.target.result);
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

  // Fallback to high quality photography preset if network was completely unavailable
  return 'https://images.unsplash.com/photo-1464822759023-fed622ff2c3b?q=80&w=1200&auto=format&fit=crop';
}

// 2. Fetch full gallery data from Centralized Cloud Database
export async function fetchCloudGalleryData() {
  try {
    // Supabase REST query
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
          const albums = await albumsRes.json();
          const media = mediaRes.ok ? await mediaRes.json() : [];
          if (Array.isArray(albums) && albums.length > 0) {
            notifySubscribers({ albums, media });
            return { albums, media };
          }
        }
      } catch (sbErr) {
        console.warn('Supabase fetch fallback:', sbErr);
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
        const result = { albums: data.albums, media: data.media || [] };
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
  const payload = {
    albums,
    media,
    updatedAt: new Date().toISOString()
  };

  // Immediate in-memory notification
  notifySubscribers({ albums, media });

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
      return { success: true, albums: data.albums || albums, media: data.media || media };
    }
  } catch (err) {
    console.error('Push to cloud error:', err);
  }
  return { success: false, albums, media };
}

// 4. Create a new album in Cloud Database
export async function createCloudAlbum(albumData) {
  let coverUrl = albumData.coverImage;
  if (coverUrl && coverUrl.startsWith('data:')) {
    coverUrl = await uploadAssetToCloud(coverUrl, `${albumData.title}_cover.jpg`);
  }

  if (!coverUrl || (typeof coverUrl === 'string' && coverUrl.trim() === '')) {
    coverUrl = 'https://images.unsplash.com/photo-1464822759023-fed622ff2c3b?q=80&w=1200&auto=format&fit=crop';
  }

  const newAlbum = {
    ...albumData,
    coverImage: coverUrl
  };

  const current = await fetchCloudGalleryData();
  const existingAlbums = (current.albums && current.albums.length > 0) ? current.albums : DEFAULT_ALBUMS;
  const updatedAlbums = [...existingAlbums.filter(a => a.id !== newAlbum.id), newAlbum];

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
    if (alb.id === albumId) {
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
  const updatedAlbums = (current.albums || []).filter(alb => alb.id !== albumId);
  const updatedMedia = (current.media || []).filter(item => item.albumId !== albumId);

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
      onProgress(i + 1, itemsList.length, item.title);
    }

    let finalMediaUrl = item.url;
    if (finalMediaUrl && finalMediaUrl.startsWith('data:')) {
      finalMediaUrl = await uploadAssetToCloud(finalMediaUrl, `${item.title || 'photo'}.jpg`);
    }

    processedItems.push({
      ...item,
      url: finalMediaUrl
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
    if (item.id === mediaId) {
      return {
        ...item,
        ...updates,
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
  const updatedMedia = (current.media || []).filter(item => item.id !== mediaId);
  await pushCloudGalleryData(current.albums || [], updatedMedia);
  return true;
}

// 10. Reset Cloud Database to Starter Default Albums
export async function resetCloudToDefaults() {
  await pushCloudGalleryData(DEFAULT_ALBUMS, []);
  return true;
}
