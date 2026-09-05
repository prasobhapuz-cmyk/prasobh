// 100% Server-Side Cloud Storage Service for Prasobh's Gallery
// All data and files are persistently managed on the centralized cloud backend

import {
  DEFAULT_ALBUMS,
  DEFAULT_MEDIA,
  fetchCloudGalleryData,
  pushCloudGalleryData,
  createCloudAlbum,
  updateCloudAlbumCover as updateCloudCover,
  deleteCloudAlbum as deleteCloudAlb,
  saveCloudMediaItems,
  updateCloudMediaItem as updateCloudMedia,
  deleteCloudMediaItem as deleteCloudMedia,
  resetCloudToDefaults,
  subscribeToCloudUpdates,
  uploadAssetToCloud
} from './cloudBackend.js';

export { DEFAULT_ALBUMS, DEFAULT_MEDIA, uploadAssetToCloud };

export const CLOUD_STORAGE_BIN_ID = 'bdbddaa';

// Subscribe to real-time cloud updates
export function onCloudSyncUpdated(callback) {
  return subscribeToCloudUpdates(callback);
}

// Initializer: Pulls live cloud state
export async function initializeStorage() {
  try {
    await fetchCloudGalleryData();
    return true;
  } catch (err) {
    console.error('Cloud storage init error:', err);
    return false;
  }
}

// Fetch all albums from cloud database
export async function getAlbums() {
  const data = await fetchCloudGalleryData();
  return data.albums && data.albums.length > 0 ? data.albums : DEFAULT_ALBUMS;
}

// Fetch all media items from cloud database
export async function getAllMedia() {
  const data = await fetchCloudGalleryData();
  return data.media || [];
}

// Save a new album to cloud database
export async function saveAlbum(album) {
  return await createCloudAlbum(album);
}

// Update album cover in cloud database
export async function updateAlbumCover(albumId, newCoverUrl) {
  return await updateCloudCover(albumId, newCoverUrl);
}

// Delete album and its media from cloud database
export async function deleteAlbum(albumId) {
  return await deleteCloudAlb(albumId);
}

// Save a single media item to cloud database
export async function saveMediaItem(mediaItem) {
  const res = await saveCloudMediaItems([mediaItem]);
  return res[0] || mediaItem;
}

// Batch save multiple media items to cloud storage & database
export async function saveMultipleMediaItems(itemsList, onProgress) {
  return await saveCloudMediaItems(itemsList, onProgress);
}

// Update caption, title, or metadata in cloud database
export async function updateMediaItem(mediaId, updates) {
  return await updateCloudMedia(mediaId, updates);
}

// Delete media item from cloud database
export async function deleteMediaItem(mediaId) {
  return await deleteCloudMedia(mediaId);
}

// Manual Cloud Sync Trigger
export async function syncFromCloud() {
  return await fetchCloudGalleryData();
}

export async function syncToCloud() {
  const data = await fetchCloudGalleryData();
  return await pushCloudGalleryData(data.albums || [], data.media || []);
}

// Export gallery backup JSON
export async function exportGalleryBackup() {
  const data = await fetchCloudGalleryData();
  const backup = {
    author: 'Prasobh',
    exportedAt: new Date().toISOString(),
    albums: data.albums,
    media: data.media
  };
  return JSON.stringify(backup, null, 2);
}

// Import gallery backup JSON directly into cloud database
export async function importGalleryBackup(jsonString) {
  try {
    const parsed = typeof jsonString === 'string' ? JSON.parse(jsonString) : jsonString;
    if (!parsed || (!parsed.albums && !parsed.media)) {
      throw new Error('Invalid gallery data format');
    }

    const albums = Array.isArray(parsed.albums) ? parsed.albums : DEFAULT_ALBUMS;
    const media = Array.isArray(parsed.media) ? parsed.media : [];

    await pushCloudGalleryData(albums, media);
    return true;
  } catch (err) {
    console.error('Import to cloud failed:', err);
    throw err;
  }
}

// Reset gallery to starter defaults in cloud database
export async function resetGalleryToDefaults() {
  return await resetCloudToDefaults();
}
