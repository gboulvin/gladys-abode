import { test } from 'node:test';
import assert from 'node:assert/strict';
import jpeg from 'jpeg-js';
import { toCameraImage } from '../src/abode/image.js';

function noisyJpeg(width, height) {
  const data = Buffer.alloc(width * height * 4);
  for (let i = 0; i < data.length; i += 1) {
    data[i] = (i * 7919) % 251;
  }
  return Buffer.from(jpeg.encode({ width, height, data }, 95).data);
}

test('a small image is passed through', () => {
  const buffer = noisyJpeg(16, 16);
  assert.equal(toCameraImage(buffer), `image/jpg;base64,${buffer.toString('base64')}`);
});

test('a large image is downscaled under the Gladys limit', () => {
  const buffer = noisyJpeg(640, 480);
  const limit = 40 * 1024;
  assert.ok(buffer.toString('base64').length > limit, 'the fixture is over the limit');
  const image = toCameraImage(buffer, limit);
  assert.ok(image.startsWith('image/jpg;base64,'));
  assert.ok(image.length <= limit);
  const decoded = jpeg.decode(Buffer.from(image.split(',')[1], 'base64'));
  assert.ok(decoded.width < 640);
});
