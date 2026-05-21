const IMAGE_EXT = /\.(jpe?g|png|gif|webp|bmp|heic|heif)$/i;

/** Mobile browsers often leave type empty; accept by extension too. */
export function isAcceptableInvoiceHeaderFile(file) {
  if (!file || !file.size) return false;
  if (file.type && file.type.startsWith('image/')) return true;
  const name = file.name || '';
  return IMAGE_EXT.test(name);
}

/** Resize/compress for mobile camera photos; outputs JPEG. */
export function prepareInvoiceHeaderFile(file, maxBytes = 5 * 1024 * 1024) {
  if (file.size <= maxBytes && /^image\/jpe?g$/i.test(file.type || '')) {
    return Promise.resolve(file);
  }

  return new Promise((resolve, reject) => {
    const img = new Image();
    const url = URL.createObjectURL(file);

    img.onload = () => {
      URL.revokeObjectURL(url);
      const maxDim = 2400;
      let { width, height } = img;
      const scale = Math.min(1, maxDim / Math.max(width, height, 1));
      width = Math.max(1, Math.round(width * scale));
      height = Math.max(1, Math.round(height * scale));

      const canvas = document.createElement('canvas');
      canvas.width = width;
      canvas.height = height;
      const ctx = canvas.getContext('2d');
      if (!ctx) {
        reject(new Error('Could not process image'));
        return;
      }
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(0, 0, width, height);
      ctx.drawImage(img, 0, 0, width, height);

      const tryQuality = (q) => {
        canvas.toBlob(
          (blob) => {
            if (!blob) {
              reject(new Error('Could not process image'));
              return;
            }
            if (blob.size > maxBytes && q > 0.5) {
              tryQuality(q - 0.12);
              return;
            }
            const base = (file.name || 'invoice-header').replace(/\.[^.]+$/, '');
            resolve(
              new File([blob], `${base}.jpg`, {
                type: 'image/jpeg',
                lastModified: Date.now(),
              })
            );
          },
          'image/jpeg',
          q
        );
      };
      tryQuality(0.88);
    };

    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error('Could not read image'));
    };

    img.src = url;
  });
}
