import { mkdir, writeFile } from 'node:fs/promises';
import { randomUUID } from 'node:crypto';
import path from 'node:path';
import sharp from 'sharp';

const MAX_CLIPBOARD_IMAGES = 20;

export function clipboardImageType(item) {
  if (!item || !Array.isArray(item.types)) return '';
  return item.types.find((type) => String(type).toLowerCase().startsWith('image/')) || '';
}

function timestamp(date) {
  return date.toISOString().replace(/[:.]/g, '-');
}

export async function saveClipboardImageItems(items, outputDirectory, now = new Date()) {
  if (!Array.isArray(items) || !outputDirectory) return [];
  const imageItems = items.filter(clipboardImageType).slice(0, MAX_CLIPBOARD_IMAGES);
  if (!imageItems.length) return [];

  await mkdir(outputDirectory, { recursive: true });
  const savedPaths = [];

  for (const item of imageItems) {
    const type = clipboardImageType(item);
    try {
      const blob = await item.getType(type);
      if (!blob || typeof blob.arrayBuffer !== 'function') continue;
      const source = Buffer.from(await blob.arrayBuffer());
      if (!source.length) continue;

      const png = await sharp(source, { failOn: 'error', limitInputPixels: 120_000_000 })
        .png({ compressionLevel: 6, adaptiveFiltering: true })
        .toBuffer();
      const filename = `Imagem colada ${timestamp(now)} ${randomUUID().slice(0, 8)}.png`;
      const destination = path.join(outputDirectory, filename);
      await writeFile(destination, png, { flag: 'wx' });
      savedPaths.push(destination);
    } catch {
      // Alguns programas anunciam formatos de imagem que não conseguem fornecer.
      // Continuamos procurando outro item válido no mesmo clipboard.
    }
  }

  return savedPaths;
}
