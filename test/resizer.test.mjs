import assert from 'node:assert/strict';
import { mkdtemp, rm } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import sharp from 'sharp';
import { imagePreview, resizeImage, resizePreview } from '../src/resizer.mjs';

async function fixture(root, name = 'origem.png') {
  const source = path.join(root, name);
  await sharp({ create: { width: 1200, height: 800, channels: 4, background: { r: 30, g: 120, b: 220, alpha: 1 } } }).png().toFile(source);
  return source;
}

test('redimensiona por porcentagem mantendo a proporção', async () => {
  const root = await mkdtemp(path.join(os.tmpdir(), 'arc-resize-'));
  try {
    const source = await fixture(root);
    const result = await resizeImage({ sourcePath: source, outputRoot: path.join(root, 'out'), relativePath: 'origem.png', options: { mode: 'percentage', percentage: 50 } });
    assert.equal(result.outputWidth, 600);
    assert.equal(result.outputHeight, 400);
  } finally { await rm(root, { recursive: true, force: true }); }
});

test('dimensões bloqueadas preservam a proporção original', async () => {
  const root = await mkdtemp(path.join(os.tmpdir(), 'arc-resize-'));
  try {
    const source = await fixture(root);
    const result = await resizeImage({ sourcePath: source, outputRoot: path.join(root, 'out'), relativePath: 'origem.png', options: { mode: 'dimensions', width: 300, height: 300, lockRatio: true, primaryDimension: 'width' } });
    assert.equal(result.outputWidth, 300);
    assert.equal(result.outputHeight, 200);
  } finally { await rm(root, { recursive: true, force: true }); }
});

test('dimensões livres geram exatamente o tamanho solicitado', async () => {
  const root = await mkdtemp(path.join(os.tmpdir(), 'arc-resize-'));
  try {
    const source = await fixture(root);
    const result = await resizeImage({ sourcePath: source, outputRoot: path.join(root, 'out'), relativePath: 'origem.png', options: { mode: 'dimensions', width: 500, height: 500, lockRatio: false } });
    assert.equal(result.outputWidth, 500);
    assert.equal(result.outputHeight, 500);
  } finally { await rm(root, { recursive: true, force: true }); }
});

test('preset social preserva proporção e entrega a medida exata', async () => {
  const root = await mkdtemp(path.join(os.tmpdir(), 'arc-resize-'));
  try {
    const source = await fixture(root);
    const result = await resizeImage({ sourcePath: source, outputRoot: path.join(root, 'out'), relativePath: 'origem.png', options: { mode: 'template', width: 1080, height: 1920, lockRatio: true } });
    assert.equal(result.outputWidth, 1080);
    assert.equal(result.outputHeight, 1920);
  } finally { await rm(root, { recursive: true, force: true }); }
});

test('gera preview leve e seguro para a interface', async () => {
  const root = await mkdtemp(path.join(os.tmpdir(), 'arc-resize-'));
  try {
    const source = await fixture(root);
    const preview = await imagePreview(source, 320, 240);
    assert.match(preview, /^data:image\/webp;base64,/);
    assert.ok(preview.length > 100);
  } finally { await rm(root, { recursive: true, force: true }); }
});

test('preview simula recorte e proporção do resultado configurado', async () => {
  const root = await mkdtemp(path.join(os.tmpdir(), 'arc-resize-'));
  try {
    const source = await fixture(root);
    const preview = await resizePreview(source, { mode: 'template', width: 1080, height: 1920, lockRatio: true }, 640, 480);
    assert.equal(preview.outputWidth, 1080);
    assert.equal(preview.outputHeight, 1920);
    assert.equal(preview.previewWidth, 270);
    assert.equal(preview.previewHeight, 480);
    const buffer = Buffer.from(preview.dataUrl.split(',')[1], 'base64');
    const metadata = await sharp(buffer).metadata();
    assert.equal(metadata.width, 270);
    assert.equal(metadata.height, 480);
  } finally { await rm(root, { recursive: true, force: true }); }
});
