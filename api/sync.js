// Vercel Serverless Function: High-Reliability Cloud Gallery Synchronizer
// Handles backend-to-backend cloud storage sync with zero browser CORS preflight restrictions

import https from 'https';

const CLOUD_STORAGE_BIN_ID = 'bdbddaa';
const CLOUD_STORAGE_URL = `https://extendsclass.com/api/json-storage/bin/${CLOUD_STORAGE_BIN_ID}`;

const DEFAULT_ALBUMS = [
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

// In-memory cache for warm lambda executions
let memoryCache = null;

function sanitizePayload(payload) {
  const cleanAlbums = (payload.albums || []).map((alb) => {
    const id = alb.folderId || alb.id || 'folder-kyoto';
    const title = alb.folderName || alb.title || 'Untitled Folder';
    return {
      ...alb,
      id,
      folderId: id,
      title,
      folderName: title,
      userId: alb.userId || 'user_prasobh_appus07',
      location: alb.location || '',
      coverImage: alb.coverImage || 'https://images.unsplash.com/photo-1493976040374-85c8e12f0c0e?q=80&w=1200&auto=format&fit=crop',
      description: alb.description || ''
    };
  });

  const cleanMedia = (payload.media || []).map((item) => {
    const mediaId = item.mediaId || item.id || `media-${Date.now()}`;
    const targetFolderId = item.folderId || item.albumId || cleanAlbums[0]?.id || 'folder-kyoto';
    return {
      ...item,
      id: mediaId,
      mediaId,
      albumId: targetFolderId,
      folderId: targetFolderId,
      userId: item.userId || 'user_prasobh_appus07',
      title: item.title || 'Photo',
      location: item.location || '',
      url: item.url || '',
      createdAt: item.createdAt || new Date().toISOString()
    };
  });

  return {
    albums: cleanAlbums,
    media: cleanMedia,
    updatedAt: payload.updatedAt || new Date().toISOString()
  };
}

function fetchFromCloud() {
  return new Promise((resolve) => {
    const req = https.get(CLOUD_STORAGE_URL + '?t=' + Date.now(), {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)',
        'Accept': 'application/json'
      },
      timeout: 10000
    }, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try {
          const parsed = JSON.parse(data);
          if (parsed && Array.isArray(parsed.albums) && parsed.albums.length > 0) {
            memoryCache = { albums: parsed.albums, media: parsed.media || [], updatedAt: parsed.updatedAt };
            resolve(memoryCache);
          } else if (memoryCache) {
            resolve(memoryCache);
          } else {
            resolve({ albums: DEFAULT_ALBUMS, media: [], updatedAt: new Date().toISOString() });
          }
        } catch (e) {
          resolve(memoryCache || { albums: DEFAULT_ALBUMS, media: [], updatedAt: new Date().toISOString() });
        }
      });
    });

    req.on('error', () => {
      resolve(memoryCache || { albums: DEFAULT_ALBUMS, media: [], updatedAt: new Date().toISOString() });
    });

    req.on('timeout', () => {
      req.destroy();
      resolve(memoryCache || { albums: DEFAULT_ALBUMS, media: [], updatedAt: new Date().toISOString() });
    });
  });
}

function pushToCloud(payload, retries = 2) {
  return new Promise((resolve) => {
    const attempt = (remainingRetries) => {
      const sanitized = sanitizePayload(payload);
      memoryCache = sanitized;

      const dataString = JSON.stringify(sanitized);
      const u = new URL(CLOUD_STORAGE_URL);

      const req = https.request({
        hostname: u.hostname,
        path: u.pathname,
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)',
          'Content-Length': Buffer.byteLength(dataString)
        },
        timeout: 12000
      }, (res) => {
        let resBody = '';
        res.on('data', chunk => resBody += chunk);
        res.on('end', () => {
          if (res.statusCode >= 200 && res.statusCode < 300) {
            resolve(true);
          } else if (remainingRetries > 0) {
            setTimeout(() => attempt(remainingRetries - 1), 300);
          } else {
            console.warn('ExtendsClass PUT returned status:', res.statusCode, resBody);
            resolve(false);
          }
        });
      });

      req.on('error', (err) => {
        if (remainingRetries > 0) {
          setTimeout(() => attempt(remainingRetries - 1), 300);
        } else {
          console.warn('ExtendsClass PUT network error:', err.message);
          resolve(false);
        }
      });

      req.on('timeout', () => {
        req.destroy();
        if (remainingRetries > 0) {
          setTimeout(() => attempt(remainingRetries - 1), 300);
        } else {
          console.warn('ExtendsClass PUT timed out');
          resolve(false);
        }
      });

      req.write(dataString);
      req.end();
    };

    attempt(retries);
  });
}

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method === 'POST') {
    try {
      let body = req.body;
      if (typeof body === 'string') {
        body = JSON.parse(body);
      }

      if (!body || !Array.isArray(body.albums)) {
        return res.status(400).json({ error: 'Invalid payload: albums array required' });
      }

      const syncPayload = {
        albums: body.albums,
        media: Array.isArray(body.media) ? body.media : [],
        updatedAt: new Date().toISOString()
      };

      const cloudSuccess = await pushToCloud(syncPayload);

      return res.status(200).json({
        success: true,
        cloudSynced: cloudSuccess,
        albums: syncPayload.albums,
        media: syncPayload.media,
        updatedAt: syncPayload.updatedAt
      });
    } catch (err) {
      console.error('POST /api/sync error:', err);
      return res.status(500).json({ error: err.message });
    }
  }

  // GET: Fetch latest cloud data
  try {
    const result = await fetchFromCloud();
    res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
    return res.status(200).json({
      success: true,
      albums: result.albums,
      media: result.media,
      updatedAt: result.updatedAt
    });
  } catch (err) {
    console.error('GET /api/sync error:', err);
    return res.status(200).json({
      success: true,
      albums: memoryCache?.albums || DEFAULT_ALBUMS,
      media: memoryCache?.media || [],
      updatedAt: new Date().toISOString()
    });
  }
}
