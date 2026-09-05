// Vercel Serverless Function: High-Reliability Cloud Image Uploader
// Stores raw asset in dedicated cloud bin and returns permanent raw image stream URL (/api/image?id=...)

import https from 'https';

function createCloudImageBin(dataUrl, filename = 'photo.jpg', retries = 3) {
  return new Promise((resolve, reject) => {
    const attempt = (remainingRetries) => {
      const payload = JSON.stringify({
        image: dataUrl,
        filename,
        uploadedAt: new Date().toISOString()
      });

      const req = https.request({
        hostname: 'extendsclass.com',
        path: '/api/json-storage/bin',
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)',
          'Content-Length': Buffer.byteLength(payload)
        },
        timeout: 15000
      }, (res) => {
        let data = '';
        res.on('data', chunk => data += chunk);
        res.on('end', () => {
          try {
            const json = JSON.parse(data);
            if (json && json.id) {
              resolve(json.id);
            } else if (remainingRetries > 0) {
              setTimeout(() => attempt(remainingRetries - 1), 350);
            } else {
              reject(new Error('No ID in bin response: ' + data));
            }
          } catch (e) {
            if (remainingRetries > 0) {
              setTimeout(() => attempt(remainingRetries - 1), 350);
            } else {
              reject(e);
            }
          }
        });
      });

      req.on('error', (err) => {
        if (remainingRetries > 0) {
          setTimeout(() => attempt(remainingRetries - 1), 350);
        } else {
          reject(err);
        }
      });

      req.on('timeout', () => {
        req.destroy();
        if (remainingRetries > 0) {
          setTimeout(() => attempt(remainingRetries - 1), 350);
        } else {
          reject(new Error('Bin creation timed out'));
        }
      });

      req.write(payload);
      req.end();
    };

    attempt(retries);
  });
}

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    let body = req.body;
    if (typeof body === 'string') {
      body = JSON.parse(body);
    }

    if (!body || !body.image) {
      return res.status(400).json({ error: 'Image data URL required' });
    }

    const dataUrl = body.image;
    // If it's already an external HTTP URL or image stream URL, just return it
    if (!dataUrl.startsWith('data:')) {
      return res.status(200).json({ success: true, url: dataUrl });
    }

    const filename = body.filename || `photo_${Date.now()}.jpg`;

    // Store in dedicated cloud storage bin
    const binId = await createCloudImageBin(dataUrl, filename, 3);
    const imageUrl = `/api/image?id=${binId}`;
    return res.status(200).json({ success: true, url: imageUrl, binId });
  } catch (err) {
    console.error('Image upload handler error:', err.message);
    return res.status(500).json({ error: 'Failed to create image cloud bin: ' + err.message });
  }
}
