export const MAX_PIXELS = 16_000_000;
export const MAX_EDGE = 4096;

export function fitDimensions(width, height) {
  const scale = Math.min(1, MAX_EDGE / width, MAX_EDGE / height, Math.sqrt(MAX_PIXELS / (width * height)));
  return { width: Math.max(1, Math.floor(width * scale)), height: Math.max(1, Math.floor(height * scale)) };
}

export function formatBytes(bytes) {
  return bytes < 1_000_000 ? `${(bytes / 1000).toFixed(1)} KB` : `${(bytes / 1_000_000).toFixed(2)} MB`;
}

function encode(canvas, type, quality) {
  return new Promise((resolve, reject) => canvas.toBlob(blob => {
    if (!blob) reject(new Error('This browser could not create the image. Try smaller dimensions.'));
    else if (blob.type !== type) reject(new Error('Your browser cannot save this format. Please choose JPG or PNG.'));
    else resolve(blob);
  }, type, quality));
}

export async function prepareImage(source, { width, height, type, target, allowResize }) {
  if (!Number.isInteger(width) || !Number.isInteger(height) || width < 1 || height < 1 || width > MAX_EDGE || height > MAX_EDGE || width * height > MAX_PIXELS) {
    throw new Error('Use dimensions from 1 to 4,096 pixels, with at most 16 million pixels in total.');
  }
  if (!['image/jpeg', 'image/png', 'image/webp'].includes(type)) throw new Error('Choose JPG, PNG, or WebP.');
  if (target !== null && (!Number.isInteger(target) || target < 1000 || target > 25_000_000)) throw new Error('Enter a whole-number size from 1 to 25,000 KB, or leave it blank.');
  const canvas = document.createElement('canvas');
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Your browser does not support image processing.');
  let blob;
  try {
    for (let attempt = 0; attempt < 24; attempt++) {
      canvas.width = width;
      canvas.height = height;
      ctx.imageSmoothingEnabled = true;
      ctx.imageSmoothingQuality = 'high';
      if (type === 'image/jpeg') { ctx.fillStyle = '#ffffff'; ctx.fillRect(0, 0, width, height); }
      ctx.drawImage(source, 0, 0, width, height);
      blob = await encode(canvas, type, .94);
      if (!target || blob.size <= target) break;
      if (type !== 'image/png') {
        const smallest = await encode(canvas, type, .08);
        if (smallest.size <= target) {
          blob = smallest;
          let low = .08;
          let high = .94;
          for (let step = 0; step < 9; step++) {
            const quality = (low + high) / 2;
            const candidate = await encode(canvas, type, quality);
            if (candidate.size <= target) { blob = candidate; low = quality; }
            else high = quality;
          }
          break;
        }
        blob = smallest;
      }
      if (!allowResize || (width === 1 && height === 1) || attempt === 23) break;
      const factor = Math.min(.85, Math.max(.25, Math.sqrt(target / blob.size) * .9));
      width = Math.max(1, Math.floor(width * factor));
      height = Math.max(1, Math.floor(height * factor));
    }
    return { blob, width, height, meetsTarget: !target || blob.size <= target };
  } finally {
    canvas.width = canvas.height = 1;
  }
}
