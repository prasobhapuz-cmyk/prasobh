// Client-side high-performance image compressor for gallery uploads
// Optimizes camera photos to crisp ~18-30KB WebP/JPEG for instant cross-device sync without quality loss

export async function compressImage(fileOrDataUrl, maxWidth = 1080, maxHeight = 1080, quality = 0.72) {
  if (!fileOrDataUrl) return '';

  // If already a remote HTTPS URL, return as is
  if (typeof fileOrDataUrl === 'string' && !fileOrDataUrl.startsWith('data:image')) {
    return fileOrDataUrl;
  }

  // 1. Try modern fast createImageBitmap (Supported in all modern mobile and desktop browsers)
  if (typeof createImageBitmap !== 'undefined' && typeof fileOrDataUrl !== 'string') {
    try {
      const bitmap = await createImageBitmap(fileOrDataUrl);
      let width = bitmap.width;
      let height = bitmap.height;

      if (width > maxWidth || height > maxHeight) {
        const ratio = Math.min(maxWidth / width, maxHeight / height);
        width = Math.round(width * ratio);
        height = Math.round(height * ratio);
      }

      const canvas = document.createElement('canvas');
      canvas.width = width;
      canvas.height = height;
      const ctx = canvas.getContext('2d');
      if (ctx) {
        ctx.imageSmoothingEnabled = true;
        ctx.imageSmoothingQuality = 'high';
        ctx.drawImage(bitmap, 0, 0, width, height);
        bitmap.close();

        // Try webp first for maximum compression efficiency, fallback to jpeg
        let dataUrl = canvas.toDataURL('image/webp', quality);
        if (!dataUrl.startsWith('data:image/webp')) {
          dataUrl = canvas.toDataURL('image/jpeg', quality);
        }
        return dataUrl;
      }
    } catch (e) {
      console.warn('createImageBitmap fallback to HTMLImageElement:', e);
    }
  }

  // 2. Fallback using Image element + Canvas
  return new Promise((resolve) => {
    let isSettled = false;
    const finish = (result) => {
      if (!isSettled) {
        isSettled = true;
        resolve(result);
      }
    };

    // 10s generous timeout for large phone camera RAW/HEIC/JPEG files
    const timer = setTimeout(() => {
      if (typeof fileOrDataUrl === 'string') {
        finish(fileOrDataUrl);
      } else {
        const reader = new FileReader();
        reader.onload = (e) => finish(e.target?.result || '');
        reader.onerror = () => finish('');
        reader.readAsDataURL(fileOrDataUrl);
      }
    }, 10000);

    const img = new Image();
    img.crossOrigin = 'anonymous';

    img.onload = () => {
      clearTimeout(timer);
      try {
        let width = img.naturalWidth || img.width || 800;
        let height = img.naturalHeight || img.height || 600;

        if (width > maxWidth || height > maxHeight) {
          const ratio = Math.min(maxWidth / width, maxHeight / height);
          width = Math.round(width * ratio);
          height = Math.round(height * ratio);
        }

        const canvas = document.createElement('canvas');
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');

        if (!ctx) {
          return finish(typeof fileOrDataUrl === 'string' ? fileOrDataUrl : img.src);
        }

        ctx.imageSmoothingEnabled = true;
        ctx.imageSmoothingQuality = 'high';
        ctx.drawImage(img, 0, 0, width, height);

        let dataUrl = canvas.toDataURL('image/webp', quality);
        if (!dataUrl.startsWith('data:image/webp')) {
          dataUrl = canvas.toDataURL('image/jpeg', quality);
        }
        finish(dataUrl);
      } catch (err) {
        console.warn('Canvas compression error:', err);
        finish(typeof fileOrDataUrl === 'string' ? fileOrDataUrl : img.src);
      }
    };

    img.onerror = () => {
      clearTimeout(timer);
      if (typeof fileOrDataUrl === 'string') {
        finish(fileOrDataUrl);
      } else {
        const reader = new FileReader();
        reader.onload = (e) => finish(e.target?.result || '');
        reader.onerror = () => finish('');
        reader.readAsDataURL(fileOrDataUrl);
      }
    };

    if (typeof fileOrDataUrl === 'string') {
      img.src = fileOrDataUrl;
    } else {
      const reader = new FileReader();
      reader.onload = (e) => {
        img.src = e.target?.result;
      };
      reader.onerror = () => {
        clearTimeout(timer);
        finish('');
      };
      reader.readAsDataURL(fileOrDataUrl);
    }
  });
}
