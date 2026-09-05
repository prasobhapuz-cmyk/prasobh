// Vercel Serverless Function: High-Speed Direct Image Streamer
// Fetches raw image binary from cloud bin and streams it with permanent CDN caching

import https from 'https';

// In-memory binary cache for ultra-fast response
const imageCache = new Map();

function fetchBinData(binId) {
  return new Promise((resolve, reject) => {
    const url = `https://extendsclass.com/api/json-storage/bin/${binId}?t=${Date.now()}`;
    const req = https.get(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)',
        'Accept': 'application/json'
      },
      timeout: 8000
    }, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try {
          const json = JSON.parse(data);
          resolve(json);
        } catch (e) {
          reject(new Error('Invalid JSON from bin'));
        }
      });
    });

    req.on('error', reject);
    req.on('timeout', () => {
      req.destroy();
      reject(new Error('Bin fetch timed out'));
    });
  });
}

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  const { id } = req.query;

  if (!id) {
    return res.status(400).json({ error: 'Missing image ID' });
  }

  // Check in-memory cache
  if (imageCache.has(id)) {
    const cached = imageCache.get(id);
    res.setHeader('Content-Type', cached.contentType);
    res.setHeader('Cache-Control', 'public, max-age=31536000, immutable');
    return res.end(cached.buffer);
  }

  try {
    const binData = await fetchBinData(id);
    if (!binData || !binData.image) {
      return res.status(404).json({ error: 'Image not found in bin' });
    }

    const dataUrl = binData.image;
    let contentType = 'image/jpeg';
    let base64String = dataUrl;

    if (dataUrl.startsWith('data:')) {
      const matches = dataUrl.match(/^data:([A-Za-z-+\/]+);base64,(.+)$/);
      if (matches && matches.length === 3) {
        contentType = matches[1];
        base64String = matches[2];
      }
    }

    const buffer = Buffer.from(base64String, 'base64');

    // Store in warm cache
    if (imageCache.size > 200) {
      const firstKey = imageCache.keys().next().value;
      imageCache.delete(firstKey);
    }
    imageCache.set(id, { buffer, contentType });

    res.setHeader('Content-Type', contentType);
    res.setHeader('Content-Length', buffer.length);
    res.setHeader('Cache-Control', 'public, max-age=31536000, immutable');
    return res.end(buffer);
  } catch (err) {
    console.error('Error streaming image:', err.message);
    return res.status(500).json({ error: 'Failed to stream image' });
  }
}
