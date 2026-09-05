// Vercel Serverless Function: Global Cloud Image Uploader
// Uploads local photos to high-speed CDN and returns permanent HTTPS image URLs

import https from 'https';

function uploadToCatbox(fileBuffer, filename = 'photo.jpg') {
  return new Promise((resolve, reject) => {
    const boundary = '----WebKitFormBoundary' + Math.random().toString(36).substring(2);
    let head = '--' + boundary + '\r\n' +
      'Content-Disposition: form-data; name="reqtype"\r\n\r\nfileupload\r\n' +
      '--' + boundary + '\r\n' +
      'Content-Disposition: form-data; name="fileToUpload"; filename="' + filename + '"\r\n' +
      'Content-Type: image/jpeg\r\n\r\n';

    const foot = '\r\n--' + boundary + '--\r\n';
    const postData = Buffer.concat([Buffer.from(head), fileBuffer, Buffer.from(foot)]);

    const req = https.request({
      hostname: 'catbox.moe',
      path: '/user/api.php',
      method: 'POST',
      headers: {
        'Content-Type': 'multipart/form-data; boundary=' + boundary,
        'Content-Length': postData.length,
        'User-Agent': 'PrasobhGallery-ImageUploader/1.0'
      },
      timeout: 15000
    }, (res) => {
      let url = '';
      res.on('data', chunk => url += chunk);
      res.on('end', () => {
        const cleanUrl = url.trim();
        if (res.statusCode === 200 && cleanUrl.startsWith('http')) {
          resolve(cleanUrl);
        } else {
          reject(new Error('Upload failed with status ' + res.statusCode + ': ' + cleanUrl));
        }
      });
    });

    req.on('error', reject);
    req.on('timeout', () => {
      req.destroy();
      reject(new Error('Upload timed out'));
    });

    req.write(postData);
    req.end();
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
    // If it's already an external HTTP URL, just return it
    if (!dataUrl.startsWith('data:')) {
      return res.status(200).json({ success: true, url: dataUrl });
    }

    // Extract base64
    const base64Data = dataUrl.replace(/^data:image\/\w+;base64,/, '');
    const buffer = Buffer.from(base64Data, 'base64');
    const filename = body.filename || `photo_${Date.now()}.jpg`;

    const cdnUrl = await uploadToCatbox(buffer, filename);

    return res.status(200).json({
      success: true,
      url: cdnUrl
    });
  } catch (err) {
    console.error('Image upload error:', err);
    return res.status(500).json({ error: err.message });
  }
}
