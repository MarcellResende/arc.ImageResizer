import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import gifenc from 'gifenc';

const { GIFEncoder } = gifenc;

const size = 96;
const palette = [
  [0, 0, 0],
  [47, 93, 255],
  [54, 207, 255],
  [239, 246, 255],
  [104, 119, 255],
  [12, 24, 55]
];

function frame() {
  return new Uint8Array(size * size);
}

function pixel(buffer, x, y, color) {
  const px = Math.round(x);
  const py = Math.round(y);
  if (px >= 0 && py >= 0 && px < size && py < size) buffer[py * size + px] = color;
}

function disc(buffer, cx, cy, radius, color) {
  for (let y = Math.floor(cy - radius); y <= Math.ceil(cy + radius); y += 1) {
    for (let x = Math.floor(cx - radius); x <= Math.ceil(cx + radius); x += 1) {
      if ((x - cx) ** 2 + (y - cy) ** 2 <= radius ** 2) pixel(buffer, x, y, color);
    }
  }
}

function ring(buffer, cx, cy, radius, thickness, color) {
  const inner = (radius - thickness) ** 2;
  const outer = radius ** 2;
  for (let y = Math.floor(cy - radius); y <= Math.ceil(cy + radius); y += 1) {
    for (let x = Math.floor(cx - radius); x <= Math.ceil(cx + radius); x += 1) {
      const distance = (x - cx) ** 2 + (y - cy) ** 2;
      if (distance >= inner && distance <= outer) pixel(buffer, x, y, color);
    }
  }
}

function rect(buffer, x, y, width, height, color) {
  for (let py = y; py < y + height; py += 1) {
    for (let px = x; px < x + width; px += 1) pixel(buffer, px, py, color);
  }
}

function line(buffer, x0, y0, x1, y1, thickness, color) {
  const steps = Math.max(Math.abs(x1 - x0), Math.abs(y1 - y0));
  for (let step = 0; step <= steps; step += 1) {
    const progress = steps === 0 ? 0 : step / steps;
    disc(buffer, x0 + (x1 - x0) * progress, y0 + (y1 - y0) * progress, thickness / 2, color);
  }
}

function encode(frames) {
  const gif = GIFEncoder();
  frames.forEach((pixels, index) => {
    gif.writeFrame(pixels, size, size, {
      palette,
      transparent: true,
      transparentIndex: 0,
      delay: 70,
      repeat: 0,
      dispose: 2,
      first: index === 0
    });
  });
  gif.finish();
  return gif.bytes();
}

function uploadFrames() {
  return Array.from({ length: 18 }, (_, index) => {
    const pixels = frame();
    const wave = Math.sin((index / 18) * Math.PI * 2);
    const radius = 31 + ((index % 9) / 9) * 9;
    ring(pixels, 48, 49, radius, 2, index % 9 < 5 ? 1 : 4);
    disc(pixels, 48, 49, 26, 5);
    ring(pixels, 48, 49, 26, 2, 4);
    const offset = Math.round(wave * 2);
    line(pixels, 48, 64 + offset, 48, 34 + offset, 6, 3);
    line(pixels, 48, 33 + offset, 36, 45 + offset, 6, 3);
    line(pixels, 48, 33 + offset, 60, 45 + offset, 6, 3);
    line(pixels, 36, 66, 60, 66, 5, 2);
    return pixels;
  });
}

function compressionFrames() {
  return Array.from({ length: 18 }, (_, index) => {
    const pixels = frame();
    const phase = (1 - Math.cos((index / 18) * Math.PI * 2)) / 2;
    const inset = Math.round(phase * 10);
    ring(pixels, 48, 48, 36, 2, 1);
    rect(pixels, 19 + inset, 28, 16, 40, 5);
    rect(pixels, 61 - inset, 28, 16, 40, 5);
    line(pixels, 29 + inset, 48, 43, 48, 5, 2);
    line(pixels, 67 - inset, 48, 53, 48, 5, 2);
    line(pixels, 43, 48, 37, 42, 4, 3);
    line(pixels, 43, 48, 37, 54, 4, 3);
    line(pixels, 53, 48, 59, 42, 4, 3);
    line(pixels, 53, 48, 59, 54, 4, 3);
    return pixels;
  });
}

const currentDirectory = path.dirname(fileURLToPath(import.meta.url));
const outputDirectory = path.join(currentDirectory, '..', 'src', 'renderer', 'assets');
await mkdir(outputDirectory, { recursive: true });
await writeFile(path.join(outputDirectory, 'upload-motion.gif'), encode(uploadFrames()));
await writeFile(path.join(outputDirectory, 'compression-motion.gif'), encode(compressionFrames()));
