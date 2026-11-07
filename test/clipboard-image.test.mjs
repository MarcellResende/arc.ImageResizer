import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, readFile, rm } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import sharp from 'sharp';
import { clipboardImageType, saveClipboardImageItems } from '../src/clipboard-image.mjs';

test('identifica imagens disponíveis no clipboard', () => {
  assert.equal(clipboardImageType({ types: ['text/plain', 'image/png'] }), 'image/png');
  assert.equal(clipboardImageType({ types: ['text/plain'] }), '');
  assert.equal(clipboardImageType(null), '');
});

test('materializa uma imagem copiada como PNG temporário válido', async () => {
  const directory = await mkdtemp(path.join(os.tmpdir(), 'arc-clipboard-test-'));
  try {
    const source = await sharp({
      create: { width: 18, height: 12, channels: 4, background: { r: 20, g: 160, b: 240, alpha: 0.5 } }
    }).webp().toBuffer();
    const item = {
      types: ['image/webp'],
      getType: async () => new Blob([source], { type: 'image/webp' })
    };

    const saved = await saveClipboardImageItems([item], directory, new Date('2026-11-06T15:00:00.000Z'));
    assert.equal(saved.length, 1);
    assert.match(path.basename(saved[0]), /^Imagem colada 2026-11-06T15-00-00-000Z .+\.png$/);

    const metadata = await sharp(await readFile(saved[0])).metadata();
    assert.equal(metadata.format, 'png');
    assert.equal(metadata.width, 18);
    assert.equal(metadata.height, 12);
    assert.equal(metadata.hasAlpha, true);
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});
