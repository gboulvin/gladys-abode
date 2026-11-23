// -----------------------------------------------------------------------------
// Camera images.
//
// Gladys takes a camera image as an `image/jpg;base64,...` string of at most
// 150 KB. Abode snapshots are often larger: they are re-encoded, halved in
// size until they fit (pure JavaScript, jpeg-js: no native dependency in the
// image).
// -----------------------------------------------------------------------------

import jpeg from 'jpeg-js';

export const MAX_CAMERA_IMAGE_SIZE = 150 * 1024;
const PREFIX = 'image/jpg;base64,';
const QUALITY = 70;
const MIN_WIDTH = 160;

/**
 * JPEG bytes -> the Gladys camera image string, downscaled when needed.
 * @param {Buffer} buffer - JPEG bytes.
 * @param {number} [maxSize] - Maximum length of the resulting string.
 */
export function toCameraImage(buffer, maxSize = MAX_CAMERA_IMAGE_SIZE) {
  const direct = PREFIX + buffer.toString('base64');
  if (direct.length <= maxSize) {
    return direct;
  }
  let image = jpeg.decode(buffer, { useTArray: true, maxMemoryUsageInMB: 256 });
  for (;;) {
    const encoded = PREFIX + Buffer.from(jpeg.encode(image, QUALITY).data).toString('base64');
    if (encoded.length <= maxSize) {
      return encoded;
    }
    if (image.width / 2 < MIN_WIDTH) {
      throw new Error('The camera image is too large for Gladys, even downscaled');
    }
    image = halve(image);
  }
}

// Box filter: every output pixel averages a 2x2 block of the input.
function halve({ width, height, data }) {
  const w = Math.max(1, Math.floor(width / 2));
  const h = Math.max(1, Math.floor(height / 2));
  const out = new Uint8Array(w * h * 4);
  for (let y = 0; y < h; y += 1) {
    for (let x = 0; x < w; x += 1) {
      for (let c = 0; c < 4; c += 1) {
        const at = (dx, dy) => data[((y * 2 + dy) * width + (x * 2 + dx)) * 4 + c];
        out[(y * w + x) * 4 + c] = (at(0, 0) + at(1, 0) + at(0, 1) + at(1, 1)) >> 2;
      }
    }
  }
  return { width: w, height: h, data: out };
}
